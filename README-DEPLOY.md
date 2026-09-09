# Deploying POMS — Vercel (frontend) + Render (backend) + Supabase (database & files)

The project is a three-part system:

| Part | Location | Deploy to | Env file |
|------|----------|-----------|----------|
| Frontend (React/Vite) | `frontend/` | **Vercel** | `frontend/.env.example` |
| Backend API (Node/Express) | `backend/` | **Render** | `backend/.env.example` |
| Database + file storage | `database/schema.sql` + `database/migrations/` | **Supabase** | configured inside the backend env |

---

## 1. Supabase — database and file storage

### 1.1 Create the database
1. Create a project at [supabase.com](https://supabase.com) (any region close to your users).
2. Open **SQL Editor** and run, **in order**:
   - `database/schema.sql` (base schema)
   - `database/migrations/001_chat.sql` through `012_tracking_security.sql` in numeric order
   - (Optional) `database/complete_schema.sql` seeds demo data — skip on production if you want a clean start.
3. The default Administrator is `admin@bsc.local` / `Admin@123` — **change this password immediately after first login** (Users & Roles → Edit).

### 1.2 Get the connection string
- Project Settings → Database → Connection string → **URI**, choose the **Pooler** (transaction mode, port `6543`).
- URL-encode special characters in the password. Example:
  `postgresql://postgres.abcdefgh:MyPass%40123@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`

### 1.3 Create the file-storage bucket
1. Supabase → **Storage** → New bucket → name it `poms-uploads`.
2. Make the bucket **public** (files such as product images and attachment previews are served by URL).
3. Project Settings → API → copy the **Project URL** and the **service_role** key.

---

## 2. Render — backend API

1. Push this repository to GitHub/GitLab.
2. Render → **New → Blueprint** and select the repo (it reads `render.yaml`), or create a Web Service manually with root directory `backend`, build `npm install`, start `npm start`.
3. Set the environment variables (see `backend/.env.example`):

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the Supabase pooler URI from step 1.2 |
| `JWT_SECRET` | any random 32+ character string (Render can generate one) |
| `JWT_EXPIRES_IN` | `8h` |
| `REFRESH_EXPIRES_IN` | `7d` |
| `CORS_ORIGIN` | your Vercel URL(s), comma separated — e.g. `https://poms.vercel.app` |
| `STORAGE_DRIVER` | `supabase` |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key from step 1.3 |
| `SUPABASE_BUCKET` | `poms-uploads` |

4. Health check path is `/api/health` (already configured). After deploy, open `https://<your-api>.onrender.com/api/health` — it must answer `{"status":"ok",...}`.

> **Single-origin alternative:** you don't *need* Vercel. Because the backend serves `frontend/dist`, you can build the frontend, deploy only the backend, and open the site directly at the Render URL. In that mode leave `CORS_ORIGIN` and `VITE_API_BASE` empty.

---

## 3. Vercel — frontend

1. Vercel → **Add New Project** → import the repo.
2. Set **Root Directory** to `frontend` (Vercel detects Vite; `vercel.json` already handles SPA rewrites).
3. Set the environment variable:

| Key | Value |
|-----|-------|
| `VITE_API_BASE` | `https://<your-api>.onrender.com/api` |

4. Deploy. Open the site — the landing page loads from Vercel and every API call goes to Render.

---

## 4. Post-deploy checklist (no errors)

- [ ] `https://<api>/api/health` → `{"status":"ok"}`
- [ ] Landing page loads from Vercel; hero text visible over the background image.
- [ ] Login shows the CAPTCHA (5 alphanumeric characters, 30-second countdown) and rejects wrong/expired codes.
- [ ] Sign in as `admin@bsc.local` — **change the default password now**.
- [ ] Upload an attachment (Attachments page) → it opens from Supabase Storage.
- [ ] Replace an attachment (🔄 button) and edit its details (✏️) — the stored file updates.
- [ ] Create a test user with a single collection scope → confirm their dashboard, PO list and PO builder show only that collection.
- [ ] Check the dashboard "Team Activity — Live" panel shows your session with IP/device.
- [ ] Confirm `CORS_ORIGIN` exactly matches your Vercel domain(s) — the browser console must show no CORS errors.

## 5. Security notes

- Passwords: bcrypt-hashed; CAPTCHA + rate limits + account lockout protect the login.
- Every endpoint re-checks role permissions, division and collection scope server-side.
- The audit trail is append-only (protected by a database trigger).
- Security headers and HTTPS-only assumptions (behind Render/Vercel proxies) are enabled automatically.
- Rotate `JWT_SECRET` only deliberately — it invalidates all sessions.
- Legal pages for users: `/privacy`, `/terms`, `/security` (linked in the landing footer).
