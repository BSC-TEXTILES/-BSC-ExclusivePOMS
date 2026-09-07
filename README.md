# POMS — Purchase Order & Merchandise Procurement Management System

**BSC Exclusive Edition** — full-stack implementation of FRS v2.0 (31 sections + 4 appendices).

Stack: **Node.js + Express + React (Vite) + PostgreSQL** — the MERN stack with PostgreSQL
replacing MongoDB, using the project's supplied SQL schema (`database/schema.sql`) as-is.

## Quick start (Windows)

Prerequisites: **Node 18+** and **PostgreSQL 15+** (the schema uses
`UNIQUE NULLS NOT DISTINCT`, which needs PG 15). The helper scripts below assume the
PostgreSQL 17 installation at `C:\Program Files\PostgreSQL\17`.

| Step | Double-click / run | What it does |
|---|---|---|
| 1 | `start-database.bat` | Starts PostgreSQL on port 5433 (data in `database/pgdata`) |
| 2 | `setup-database.bat` *(first time only)* | Creates the `poms` database, loads `database/schema.sql`, seeds master data + demo users |
| 3 | `start-website.bat` | Serves the whole site — frontend + API — on **http://localhost:4040** |

Sign in: **admin@bsc.local / Admin@123** (Super Admin — all other demo roles listed on the
login screen).

Manual equivalent (any OS):

```bash
# 1. Database — create it, then load the supplied schema
createdb poms                       # or: CREATE DATABASE poms;
psql -d poms -f database/schema.sql

# 2. Backend API (also serves the built frontend)
cd backend
cp .env.example .env                # set DATABASE_URL + JWT_SECRET
npm install
npm run seed                        # roles, permissions, 21 sections, sizes, colours,
                                    # approval rules (₹25k/₹1L), settings, demo users
npm run dev                         # site on http://localhost:4040

# 3. Frontend — only needed when developing the React app
cd frontend
npm install
npm run dev                         # Vite dev server on :5173 (proxies /api → :4040)
npm run build                       # production build → frontend/dist (what the API serves)
```

### Demo accounts (created by seed — change in production)

| Login | Password | Role |
|---|---|---|
| admin@bsc.local | Admin@123 | Super Admin (all divisions) |
| dvg.admin@bsc.local | Admin@123 | Domain Admin (Davanagere) |
| pm.dvg@bsc.local | PM@12345 | Purchase Manager (Davanagere) |
| buyer.dvg@bsc.local | PE@12345 | Purchase Executive (Davanagere) |
| approver.dvg@bsc.local | AP@12345 | Approver (Davanagere) |
| receiver.dvg@bsc.local | RC@12345 | Receiving User (Davanagere) |
| viewer@bsc.local | VW@12345 | Viewer |
| auditor@bsc.local | AU@12345 | Auditor |

End-to-end demo path: sign in as **buyer.dvg** → Create Master PO (guided stepper,
colour × size matrix) → Save & Submit → sign in as **pm.dvg** → Approval Queue →
Approve → Issue → as **receiver.dvg** → Receiving → New Receipt (partial!) → check
dashboard, audit trail and reports as **admin**.

## Repository layout (three tiers)

```
D:\BSC_P_O
├── README.md                        ← this file
├── start-database.bat               ← start / stop the PostgreSQL database
├── stop-database.bat
├── setup-database.bat               ← one-time: schema + seed data
├── start-website.bat                ← run the whole site on http://localhost:4040
│
├── frontend/                        ← TIER 1 — React 18 + Vite SPA
│   ├── package.json
│   ├── vite.config.js               ← dev proxy /api → localhost:4040
│   └── src/
│       ├── App.jsx, auth.jsx, api.js, styles.css
│       ├── components/              ← Modal, StatusChip, form fields
│       └── pages/                   ← Login, Dashboard, POList, POCreate (stepper +
│                                       matrix), PODetails, Approvals, Receipts,
│                                       Masters, Users, Reports, AuditLogs
│
├── backend/                         ← TIER 2 — Express + PostgreSQL API
│   ├── package.json                 ← start / dev / seed / e2e / check scripts
│   ├── .env                         ← DATABASE_URL, JWT_SECRET, PORT=4040
│   ├── scripts/
│   │   ├── seed.js                  ← idempotent master-data + demo-user seeding
│   │   └── e2e.mjs                  ← 47-check end-to-end lifecycle test
│   └── src/
│       ├── app.js / server.js       ← wiring; serves frontend/dist (single site)
│       ├── config/db.js             ← pg pool + withTransaction
│       ├── middleware/auth.js       ← JWT auth, permission + division-scope guards
│       ├── middleware/errors.js     ← FK/unique violations → RB-014 / SC-3 messages
│       ├── utils/pricing.js         ← §13.1/§13.2 engine (RB-017, self-tested at boot)
│       ├── utils/audit.js           ← §17.1 audit writer (append-only table)
│       ├── utils/notify.js          ← §18 in-app notifications
│       └── routes/                  ← auth, users, masters, purchaseOrders,
│                                      approvals, receipts, inventory, reports, misc
│
├── database/                        ← TIER 3 — database assets
│   ├── schema.sql                   ← supplied core schema v1.0 (§20.2 table set)
│   └── pgdata/                      ← local PostgreSQL 17 cluster (port 5433)
│
├── docs/                            ← FRS v2.0, delivery package, OpenAPI contract
│   ├── FRS.md
│   ├── Delivery-Package.md
│   └── api/openapi.yaml
└── jira/                            ← Jira import (130 issues) + generator script
```

## FRS traceability — where each rule is enforced

| Rule | Enforcement point |
|---|---|
| RB-001 division scope | `backend/src/middleware/auth.js` `scopeDivision` + every query filtered by `user_divisions` |
| RB-002 active masters only | `purchaseOrders.js` `assertActiveRefs` (division/section/supplier) |
| RB-003 history readable after master edits | §20.3 snapshots: `writeSnapshots` at submit/approve/issue |
| RB-004/005 unique serials, brand number ≠ serial | DB unique constraints + brand duplicate-match warning (§25) |
| RB-006/007 quantity = variant sum, positive ints | `priceLine` recomputes total from the matrix |
| RB-008 price ≥ 0 | `priceLine` + DB `CHECK (purchase_price >= 0)` |
| RB-009 discount policy | settings `max_discount_percent` → block, or override permission + reason |
| RB-010 margin policy | settings `max_margin_percent` → same gate |
| RB-011 approved POs immutable | `PUT /:id` draft-only; changes via `/amend` version event |
| RB-012 reject/send-back need reason | route validation + DB `rejection_needs_reason` CHECK |
| RB-013 receipts reconcile | pending = ordered − accepted; over-receipt blocked before insert |
| RB-014 archive not delete | lifecycle states; FK violations surfaced as 409 with guidance |
| RB-015 critical transitions audited | `logAudit` on create/edit/submit/approve/issue/receive/close… |
| RB-016 custom values flagged | colours `is_custom`, visible "Custom" marking in UI |
| RB-017 server-side totals | `persistLines` recomputes everything from inputs; client values ignored; engine self-test vs §13.3 (₹65,520.00) at boot |
| RB-018 no cross-division leaks | every list/report query scoped by `user_divisions` |

Approval thresholds (₹0–25k Admin / ₹25k–1L Division Manager / >₹1L Super Admin) are
**configurable data** in `approval_rules` / `approval_levels` — no code change needed.
If no rule matches, the PO lands in the Super Admin **exception queue** (§25 / SA-06)
and cannot be issued until actioned.

## Verification — 47/47 end-to-end checks passing

The full lifecycle is verified against a real PostgreSQL 17 instance.
`backend/scripts/e2e.mjs` boots the API and drives it over HTTP, asserting:
auth + wrong-password rejection, RB-001 division scoping, data-driven matrix (TC-04),
the FRS §13.3 worked example to the paisa (net ₹910 / final ₹819 / line total ₹65,520,
grand ₹77,313.60 with 18% CGST+SGST), RB-006/008/009/011/012 gates, Tier-2 approval
routing + queue visibility, RB-003 snapshot integrity across a live brand rename,
issue, partial receipt 70/5/5 → accepted 60 → inventory, over-receipt block (RB-013),
auto-transition to Received, cross-division leak check (RB-018), Tier-1 approval,
amendment v2 + version chain (AU-02), dashboard, PO register, audit stream, notifications.

```bash
cd backend
DATABASE_URL=postgresql://postgres@localhost:5433/poms npm run e2e
```

Other checks: `npm run check` in `backend/` (entry-point syntax; all routes individually
checked), boot-time pricing self-test (§13.3), clean `npm run build` in `frontend/`.
OpenAPI contract: `docs/api/openapi.yaml` — import into Swagger UI/Postman.

## Docs & handoff artifacts

- **FRS** — `docs/FRS.md` (source of truth for every formula and rule above)
- **Delivery package** — `docs/Delivery-Package.md` (Confluence page tree, DOCX style
  map, 34 user stories with Gherkin ACs, 12-week Phase-1 plan)
- **Jira import** — `jira/user-stories.csv` (regenerate with `node jira/generate-csv.js`)
- **API contract** — `docs/api/openapi.yaml`
- Original PDF brief at repository root.

# BSC-Exclusive-POMS
