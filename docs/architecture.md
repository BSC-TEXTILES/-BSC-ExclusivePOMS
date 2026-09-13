# System Architecture — BSC Exclusive POMS

## High-Level Architecture

```mermaid
graph TB
    subgraph Frontend["React + Vite SPA"]
        A[Login / Auth] --> B[Dashboard]
        B --> C[Men's Collection]
        C --> C1[Products]
        C --> C2[Brands]
        C --> C3[Categories]
        C --> C4[Colors]
        C --> C5[Sizes]
        C --> C6[Manufacturers]
        C --> C7[Purchase Orders]
        B --> D[Management]
        D --> D1[Locations]
        D --> D2[Suppliers]
        D --> D3[Divisions]
        D --> D4[Users]
        B --> E[Reports]
        B --> F[System]
        F --> F1[Audit Logs]
        F --> F2[Settings]
    end

    Frontend -- "REST API (JSON)" --> Backend
    Frontend -- "JWT Bearer Token" --> Backend

    subgraph Backend["Express.js + Node.js"]
        G[Auth Middleware] --> H[Routes]
        H --> H1[/auth]
        H --> H2[/masters]
        H --> H3[/purchase-orders]
        H --> H4[/reports]
        H --> H5[/notifications]
        H --> H6[/locations]
        H --> H7[/product-types]
        G --> I[RBAC Permissions]
    end

    Backend -- "SQL (pg library)" --> Database

    subgraph Database["PostgreSQL"]
        J[(users / roles / user_roles)]
        K[(permissions / role_permissions)]
        L[(brands / categories / subcategories / product_types)]
        M[(products / product_variants / colours / sizes / manufacturers)]
        N[(purchase_orders / po_items / po_item_quantities)]
        O[(approvals / approval_instances / approval_actions)]
        P[(locations / divisions / departments / sections / suppliers)]
        Q[(audit_logs / settings / notifications)]
        R[(attachments)]
    end

    Backend -- "multer" --> FS[(Uploads ./uploads/yyyy/mm/)]
```

## Authentication & Authorization Flow

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant BE as Express API
    participant DB as PostgreSQL

    User->>FE: Enter credentials
    FE->>BE: Clerk handles sign-in (email/password or SSO)
    BE->>BE: verifyToken(Clerk JWT)
    BE->>DB: SELECT from users WHERE clerk_id or email
    BE-->>FE: { user: { id, name, roles, isSuperAdmin } }

    loop Every authenticated request
        FE->>BE: Authorization: Bearer <Clerk session token>
        BE->>BE: Clerk verifyToken(token) → decoded
        BE->>BE: req.user = decoded
        alt isSuperAdmin = true
            BE->>BE: bypass all permission checks
        else Normal user
            BE->>DB: SELECT permissions FROM user_roles JOIN role_permissions
            DB-->>BE: permission codes[]
            BE->>BE: checkPermission(code) → true/false
        end
    end
```

## RBAC Permission Model

```mermaid
erDiagram
    users ||--o{ user_roles : "has"
    roles ||--o{ user_roles : "assigned to"
    roles ||--o{ role_permissions : "grants"
    permissions ||--o{ role_permissions : "granted via"

    users {
        uuid id PK
        varchar name
        varchar email UK
        varchar phone UK
        varchar password_hash
        varchar status
    }

    roles {
        uuid id PK
        varchar name UK
        varchar description
    }

    permissions {
        uuid id PK
        varchar code UK
        varchar description
    }

    user_roles {
        uuid user_id FK
        uuid role_id FK
        uuid division_id FK
    }

    role_permissions {
        uuid role_id FK
        uuid permission_id FK
    }
```

**Permission codes** — 50+ codes covering:
- `masters.read`, `masters.write` — all master data CRUD
- `po.view`, `po.create`, `po.edit`, `po.submit`, `po.amend`, `po.issue`, `po.close`
- `approvals.view`, `approvals.act`
- `reports.read`
- `settings.write`
- `users.admin`
- `product_types.read`, `product_types.write`

**Admin bypass**: Both `super_admin` and `admin` roles bypass all permission checks (`auth.js:isSuperAdmin`).

## Purchase Order Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft : Create PO (po.create)
    Draft --> Draft : Edit (po.edit)
    Draft --> Submitted : Submit (po.submit)
    Submitted --> UnderReview : Auto on submit
    UnderReview --> Approved : Approve (approvals.act)
    UnderReview --> Rejected : Reject (approvals.act)
    UnderReview --> SentBack : Send Back (approvals.act)
    UnderReview --> Hold : Hold (approvals.act)
    UnderReview --> Escalated : Escalate (approvals.act)
    SentBack --> Draft : Resubmit
    Rejected --> [*]
    Approved --> Issued : Issue (po.issue)
    Issued --> PartiallyReceived : Receive goods
    PartiallyReceived --> Received : Close (po.close)
    Received --> [*]
    Approved --> Amended : Amend (po.amend)
    Amended --> [*]
```

## PO Data Model

```mermaid
erDiagram
    purchase_orders ||--o{ po_items : "has"
    po_items ||--o{ po_item_quantities : "has sizes"
    purchase_orders ||--o{ po_taxes : "has taxes"
    purchase_orders ||--o{ po_charges : "has charges"
    purchase_orders ||--o{ approval_instances : "approval flow"
    purchase_orders ||--o{ attachments : "file uploads"
    purchase_orders }o--|| locations : "delivery to"
    purchase_orders }o--|| suppliers : "supplier"
    purchase_orders }o--|| divisions : "division"
    purchase_orders }o--|| departments : "department"
    purchase_orders }o--|| sections : "section"

    purchase_orders {
        uuid id PK
        varchar po_number UK
        int version
        uuid location_id FK
        uuid supplier_id FK
        uuid division_id FK
        varchar status
        numeric grand_total
        jsonb totals_snapshot
    }

    po_items {
        uuid id PK
        uuid po_id FK
        int line_no
        uuid product_id FK
        uuid brand_id FK
        uuid colour_id FK
        numeric purchase_price
        numeric margin_percent
        numeric line_total
    }

    po_item_quantities {
        uuid id PK
        uuid po_item_id FK
        uuid size_id FK
        int quantity
    }
```

## File Upload & Storage

```mermaid
flowchart LR
    A[Frontend form] -- "multipart/form-data" --> B[multer middleware]
    B -- "200MB limit" --> C[storage.js]
    C -- "generateFilename()" --> D["uploads/yyyy/mm/"]
    C -- "INSERT" --> E[(attachments)]
    E -- "url column" --> F[Frontend renders link]

    style D fill:#e8f5e9
```

## Dashboard Data Flow

```mermaid
flowchart TD
    A[Dashboard.jsx] -- "GET /api/reports/dashboard" --> B[reports.js]
    B -- "overallStats" --> C[COUNT products, brands, colours, sizes, users, locations]
    B -- "kpis" --> D[COUNT purchase_orders with date filters]
    B -- "productKpis" --> E[SUM selling_value, profit; AVG margin]
    B -- "topCategories" --> F[GROUP BY category with product count]
    B -- "recentProducts" --> G[LIMIT 5 products with images]
    B -- "recentPOs" --> H[LIMIT 5 latest POs]

    D --> D1[today_orders]
    D --> D2[week_orders]
    D --> D3[month_orders]
    D --> D4[total_quantity]

    E --> E1[total_products]
    E --> E2[total_selling_value]
    E --> E3[total_profit]
    E --> E4[avg_margin]
```

## Men's Collection Navigation

```mermaid
graph LR
    subgraph "MEN'S COLLECTION"
        A[Dashboard] --> A1["Overview + Stats"]
        B[Products] --> B1["1130 items with pricing"]
        C[Brands] --> C1["33 brands + logo/image"]
        D[Categories] --> D1["Category hierarchy"]
        E[Colors] --> E1["10 colors + images"]
        F[Sizes] --> F1["39 sizes"]
        G[Manufacturers] --> G1["Manufacturer list"]
        H[Purchase Orders] --> H1["36 POs + lifecycle"]
    end
```

## Frontend Routing

| Path | Component | Permission |
|---|---|---|
| `/login` | Login | — |
| `/men/dashboard` | Dashboard | — |
| `/men/products` | Products | `masters.read` |
| `/men/brands` | Brands | `masters.read` |
| `/men/categories` | Categories | `masters.read` |
| `/men/colors` | Colors | `masters.read` |
| `/men/sizes` | Sizes | `masters.read` |
| `/men/manufacturers` | Manufacturers | `masters.read` |
| `/men/purchase-orders` | PurchaseOrders | `po.view` |
| `/locations` | Locations | `masters.read` |
| `/purchase-orders/new` | POCreate | `po.create` |
| `/purchase-orders/:id` | PODetails | `po.view` |
| `/reports` | Reports | `reports.read` |
| `/settings` | Settings | `settings.write` |
| `/audit` | AuditLogs | `settings.write` |

## API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | JWT authentication |
| GET | `/api/auth/me` | Current user + permissions |
| GET | `/api/reports/dashboard` | Dashboard stats (overall + KPIs + product KPIs) |
| GET | `/api/brands` | List brands |
| POST | `/api/brands/:id/logo` | Upload brand logo |
| POST | `/api/brands/:id/image` | Upload brand image |
| GET | `/api/colours` | List colors |
| POST | `/api/colours/:id/image` | Upload color image |
| GET | `/api/locations` | List locations |
| POST | `/api/locations` | Create location |
| PATCH | `/api/locations/:id` | Update location |
| DELETE | `/api/locations/:id` | Delete location |
| GET | `/api/product-types` | List product types |
| POST | `/api/product-types` | Create product type |
| PATCH | `/api/product-types/:id` | Update product type |
| DELETE | `/api/product-types/:id` | Delete product type |
| GET | `/api/purchase-orders` | List POs with pagination |
| POST | `/api/purchase-orders` | Create PO |
| GET | `/api/purchase-orders/:id` | PO detail with location |
| POST | `/api/purchase-orders/:id/submit` | Submit PO |
| POST | `/api/purchase-orders/:id/issue` | Issue PO |
| POST | `/api/purchase-orders/:id/amend` | Amend PO |
| POST | `/api/purchase-orders/:id/close` | Close PO |
| POST | `/api/purchase-orders/:id/approval-action` | Approve/reject/hold/escalate |
| GET | `/api/purchase-orders/:id/pdf` | Download PO as PDF |
| GET | `/api/purchase-orders/:id/csv` | Download PO as CSV |
| GET | `/api/notifications` | List notifications |
| GET | `/api/audit-logs` | Audit log history |
