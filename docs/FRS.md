# PURCHASE ORDER & MERCHANDISE PROCUREMENT MANAGEMENT SYSTEM

**Complete Project Documentation — BSC Exclusive Furniture & Lifestyle Edition**

*Functional Requirements Specification (FRS) + System Design + Workflows + Data Model + UI/UX + Testing Blueprint + BSC Merchandise Catalogue*

---

## DOCUMENT CONTROL

| Item | Value |
|---|---|
| **Project Type** | Full-stack enterprise web application |
| **Primary Business** | Retail merchandise procurement / purchase ordering |
| **Divisions** | Davanagere, Shivamogga, Belagavi |
| **Initial Sections** | Approximately 18, configuration-driven |
| **Primary Roles** | Super Admin, Admin/Domain Admin, Purchase User/Executive, Approver, Receiving User, Viewer, Auditor |
| **Document Version** | 2.0 |
| **Prepared** | 5 September 2026 |
| **Source Basis** | Uploaded Purchase Order Management System requirements and supplied master prompt |

### Version History

| Version | Date | Author / Owner | Description |
|---|---|---|---|
| 1.0 | 5 Sep 2026 | Project Team | Initial functional requirements |
| 2.0 | 5 Sep 2026 | Project Team | Expanded complete project documentation with diagrams, data model, architecture, UI, testing, security, deployment and implementation roadmap |

*Classification: Confidential — Internal Project Documentation*

---

## SYSTEM ORGANIZATIONAL & PRODUCT HIERARCHY (Overview)

```
                    ORGANIZATION
                         │
        ┌────────────────┼────────────────┐
     DIVISIONS:  Davanagere | Shivamogga | Belagavi
                         │
   DEPARTMENTS:  Men | Women | Kids | Home Furnishing
                         │
        SECTIONS (18+ configurable, dynamic)
                         │
   ┌─────────────┬───────┴────────┬─────────────────┐
CATEGORIES      BRANDS       PRODUCTS / VARIANTS
                             (Size | Colour | Style)
```

---

# TABLE OF CONTENTS

1. Executive Summary
2. Project Objectives and Success Criteria
3. Scope and Boundaries
4. Business Context and Stakeholders
5. Organizational Hierarchy and Configuration Model
6. Roles, Authentication and Authorization
7. Master Data Management
8. Section Catalogue and the 18 Initial Sections + Furniture Extension
9. Size, Colour and Variant Management
10. Product and Brand Management
11. Dealer / Supplier Management
12. Purchase Order Functional Requirements
13. Pricing, Margin, Discount, Tax and Charges
14. Approval and Governance Workflow
15. Receiving and Inventory Integration
16. Dashboards, Reporting and Analytics
17. Audit Trail, History and Document Management
18. Notifications and Communication
19. UI/UX and Screen Specifications
20. Data Model and Database Requirements
21. API and Integration Requirements
22. Security Requirements
23. Non-Functional Requirements
24. Business Rules and Validation Rules
25. Exception and Edge-Case Handling
26. Testing and Acceptance Criteria
27. Implementation Phases and Delivery Plan
28. Deployment, Backup and Operations
29. Future Enhancements and Market Benchmark Features
30. Glossary
31. Final End-to-End Flow
- Appendix A — Screen Inventory
- Appendix B — Suggested API Inventory
- Appendix C — Sample PO Data Structure
- Appendix D — Implementation Definition of Done

---

# 1. EXECUTIVE SUMMARY

This project is a **centralized, secure and configurable Purchase Order (PO) and Merchandise Procurement Management System** for a multi-division retail business. The application is designed to replace manual or spreadsheet-based purchasing with a controlled digital workflow that captures the complete purchasing decision:

- **Division** (Davanagere, Shivamogga, Belagavi)
- **Department** (Men's, Women's, Kids, Home Furnishing)
- **Section** (~18 configurable merchandise sections)
- **Brand** (brand number, name, serial number)
- **Product** (product serial number, SKU)
- **Colour**
- **Size-wise quantity**
- **Purchase price, margin, discount**
- **Dealer and final value**

The system is **intentionally configuration-driven**. Administrators must be able to create, modify, activate, deactivate, reorder and archive sections, sizes, colours, brands, products, dealers, approval rules and other master data **without requiring code changes**. Historical transactions must remain intact when a master record is retired.

The target operating model is a **full procurement lifecycle**:

> Authenticate the user → select an authorized division → choose the department/section → choose or create master data → enter variant quantities → calculate commercial values → select a dealer → submit for approval → issue a purchase order → receive goods in partial or full quantities → update inventory → expose the result through dashboards, reports and a full audit history.

---

# 2. PROJECT OBJECTIVES AND SUCCESS CRITERIA

## 2.1 Core Objectives

1. Digitize the complete purchase-order raising and approval process across all divisions and product sections.
2. Provide a reusable master-data model instead of hard-coded categories.
3. Capture apparel size curves and colour matrices efficiently for large purchase orders.
4. Support special structures for sarees, jewellery, kids, footwear, accessories and home furnishing.
5. Ensure brand number, brand name, brand serial number and product serial number are independently maintained.
6. Allow catalogue-driven selection and safe manual entry through the **Other** option.
7. Automatically calculate quantity, gross value, margin, discount, tax, charges and final value using server-side rules.
8. Give Super Admin enterprise-wide visibility while restricting Domain Admins and other users to their authorized scope.
9. Provide approval governance, amendment/versioning, receiving, inventory integration and auditability.
10. Provide exportable operational and management reporting.
11. Create a platform that can later integrate with accounting, ERP, POS, WMS, vendor portals and smart replenishment engines.

## 2.2 Success Criteria

| # | Criterion |
|---|---|
| SC-1 | No unauthorized user can access another division's protected data. |
| SC-2 | No approved PO can be silently altered. |
| SC-3 | No master record duplication is permitted where the business identifier is unique. |
| SC-4 | All key monetary calculations are reproducible and server-validated. |
| SC-5 | PO history remains understandable after section/product/master-data changes. |
| SC-6 | Users can enter size/colour quantities quickly without excessive navigation. |
| SC-7 | Super Admin can consolidate all three divisions from one dashboard. |
| SC-8 | Every critical change is attributable to a user, timestamp and before/after state. |

---

# 3. SCOPE AND BOUNDARIES

## 3.1 In Scope

- Web application with secure authentication and role-based access control.
- Multi-division operations for Davanagere, Shivamogga and Belagavi.
- Approximately 18 initial sections, with unlimited future extension.
- Department, section, category, brand, product, size, colour and dealer masters.
- Size/colour/variant quantity matrices.
- Purchase order creation, draft, submission, approval, issue, amendment and closure.
- Price, margin, discount, tax and additional-charge calculation.
- Partial and full goods receiving.
- Inventory transaction update on accepted receipt.
- Super Admin and Domain Admin dashboards.
- Reports, exports, comments, attachments and audit trail.
- Import/export facilities for master data and transactions.
- API-ready architecture for future integrations.

## 3.2 Phase 1 Boundaries (Exclusions)

| Exclusion | Rationale |
|---|---|
| Direct EDI/API integration with dealer ERP systems | Deferred to a later phase |
| POS billing | Outside the procurement system |
| Bin-level warehouse put-away | Deferred to a WMS layer |
| Advanced auto-replenishment | Depends on sales/POS data; future-phase functionality |

---

# 4. BUSINESS CONTEXT AND STAKEHOLDERS

| Stakeholder | Primary Responsibility | System Need |
|---|---|---|
| **Super Admin / Head Office** | Enterprise governance | All divisions, configuration, approvals, audit, consolidated reporting |
| **Domain / Division Admin** | Day-to-day branch procurement | Own division purchasing, section configuration within limits, dealers, approvals |
| **Purchase Executive / User** | PO data entry | Fast draft creation, product/variant quantity entry |
| **Approver / Manager** | Commercial governance | Review price, margin, discount and justification |
| **Receiving / Inventory User** | Goods receipt | Record received, damaged, rejected and pending quantities |
| **Auditor** | Control and verification | Read-only access to history and audit evidence |
| **Finance / Accounts** (future or read-only) | Financial reconciliation | PO value, supplier details, receipt and invoice linkage |

---

# 5. ORGANIZATIONAL HIERARCHY AND CONFIGURATION MODEL

The application shall use a **centralized hierarchy** in which transactional data is linked through a controlled organizational and product structure. The division selected at the beginning of the workflow determines the permitted data scope and reporting roll-up.

**Hierarchy:** Organization → Division → Department → Section → Category → Brand → Product → Variant

| Level | Examples | Administrative Rules |
|---|---|---|
| **Division** | Davanagere, Shivamogga, Belagavi | Super Admin controls; users are assigned one or more scopes |
| **Department** | Men's, Women's, Kids, Home Furnishing | Admin configurable |
| **Section** | Men's Shirts, Sarees, Jewellery, etc. | Dynamic; add/edit/activate/deactivate/archive |
| **Category/Subcategory** | Shirts → Formal Shirts | Dynamic |
| **Brand** | Brand Number + Name + Serial | Unique identifiers and reusable master |
| **Product** | Product Serial + SKU + Name | Belongs to brand/category; supports variants |
| **Variant** | Size, Colour, Style, other attributes | Configured per product/section |

---

# 6. ROLES, AUTHENTICATION AND AUTHORIZATION

## 6.1 Role Model

| Role | Access Scope | Key Capabilities |
|---|---|---|
| **Super Admin** | All divisions and modules | Full configuration, user management, approvals, audit, reports, exports |
| **Admin / Domain Admin** | Assigned division(s) | Manage local purchasing, dealers, sections within allowed policy, division dashboard |
| **Purchase Manager** | Assigned division(s)/departments | Create/manage POs and review commercial details |
| **Purchase Executive** | Assigned division + section | Create draft POs; no final price/discount authority unless granted |
| **Approver** | Assigned approval queue | Approve/reject/send back based on configured rules |
| **Receiving User** | Assigned division | Create receipts and update received status |
| **Viewer** | Assigned reporting scope | Read-only dashboards/reports |
| **Auditor** | Audit scope | Read-only historical activity and audit evidence |

## 6.2 Authentication Requirements

- Username/email + password authentication.
- Password reset and forced-reset capability.
- Account activation/deactivation.
- Session timeout and session invalidation.
- Optional MFA/OTP.
- Role resolution after authentication.
- Division-scope resolution before transaction access.
- Backend authorization on every protected API endpoint.

## 6.3 Security & Access Control Flow

```
Login → Credential Validation → Role Resolution →
Division Scope Resolution → Permission Check → API Authorization →
Action → Audit Event → Session / Security Monitoring
```

The source requirements call for role-based access control at both **UI and API layers** and secure password/session handling.

---

# 7. MASTER DATA MANAGEMENT

Master data is the **control layer** of the application. The system shall avoid free-text duplication wherever controlled values exist. Administrators shall manage master data through dedicated screens, with audit logging and lifecycle states.

| Master | Core Fields | Controls |
|---|---|---|
| **Division** | Code, name, location, contact, status | Unique code; scoped access |
| **Department** | Code, name, parent division or global flag | Active/inactive |
| **Section** | Name, parent group, sizing method, display order, attributes | Configurable; archive rather than destructive delete |
| **Category** | Code, name, parent section | Unique within parent |
| **Brand** | Brand number, name, serial, code, manufacturer, supplier | Duplicate prevention |
| **Product** | Serial, SKU, name, brand, section, attributes | Unique serial/SKU policy |
| **Size** | Method, label, order, numeric/code value | Section-specific sets |
| **Colour** | Name, code, family, swatch | Normalized values |
| **Dealer/Supplier** | Code, company, GSTIN/PAN, contacts, terms | Supplier lifecycle + history |
| **Number Sequence** | Prefix, year, division, running number | Concurrency-safe generation |

---

# 8. SECTION CATALOGUE — 18 INITIAL SECTIONS + FURNITURE EXTENSION

The source document defines 18 illustrative sections and requires the section structure to be **data-driven**. The system shall treat these as initial configuration rather than immutable code.

## 8.1 Initial Section Configuration

| # | Section | Parent Group | Sizing Method |
|---|---|---|---|
| 1 | Men's Shirts | Men's Wear | S / M / L / XL / XXL / XXXL |
| 2 | Men's Trousers & Jeans | Men's Wear | Waist 28–44 + apparel sizes where applicable |
| 3 | Men's T-Shirts | Men's Wear | S / M / L / XL / XXL / XXXL |
| 4 | Men's Ethnic Wear (Kurta/Sherwani) | Men's Wear | S / M / L / XL / XXL / XXXL |
| 5 | Men's Innerwear | Men's Wear | S / M / L / XL / XXL |
| 6 | Women's Sarees | Women's Wear | Free Size / Custom |
| 7 | Women's Kurtis & Salwar Sets | Women's Wear | S / M / L / XL / XXL / XXXL |
| 8 | Women's Western Wear | Women's Wear | S / M / L / XL / XXL / XXXL |
| 9 | Women's Ethnic / Blouse Fabric | Women's Wear | Free Size / Stitched sizes |
| 10 | Women's Innerwear | Women's Wear | S / M / L / XL / XXL |
| 11 | Jewellery — Fashion / Artificial | Women's Wear → Jewellery | Free Size / Adjustable |
| 12 | Jewellery — Bangles & Sets | Women's Wear → Jewellery | Numeric bangle sizes |
| 13 | Kids Boys Wear | Kids | Age group 0–16 years |
| 14 | Kids Girls Wear | Kids | Age group 0–16 years |
| 15 | Kids Infant Wear | Kids | Age group 0–24 months |
| 16 | Footwear — Men | Men's Wear | UK size 6–12 |
| 17 | Footwear — Women | Women's Wear | UK size 3–8 |
| 18 | Accessories (Belts, Bags, Watches) | Men's / Women's Wear | Free Size / configurable |
| 19 | Furniture & Home Interiors | Home / Lifestyle | Configurable: Single / Set / Dimension / Custom |

## 8.2 Home Furnishing Extension

Home Furnishing must be supported as a dedicated configurable section or department group. Typical items include: bedsheets, blankets, pillows, pillow covers, curtains, towels, carpets, mats, cushions, table covers, sofa covers, rugs and kitchen textiles.

**Suggested attributes:** material, dimensions, size, colour, pattern, unit, quantity, purchase price, discount, margin, tax, net value, dealer and remarks.

## 8.3 Furniture & Home Interiors Extension

Furniture is added as a **first-class procurement section** in this system. It is separate from Home Furnishing because furniture requires different attributes, dimensions, units, delivery considerations, assembly information and quantity handling than textile home-furnishing products.

> **BSC note:** Publicly available information about B.S. Channabasappa & Sons / BSC identifies a broad lifestyle and home-furnishing offering. The official company information specifically references dedicated ladies, kids, men's wear and home-furnishing spaces, while a public BSC Exclusive description also lists sarees, womenswear, kidswear, menswear, toys, accessories and home furnishings. The exact live furniture SKU assortment is not published as an exhaustive online catalogue; therefore, the furniture product taxonomy is a **system-ready procurement master structure** and should be treated as configurable rather than a claim that every listed SKU is currently stocked at every outlet.

### 8.3.1 Furniture Product Sections and Detailed Product Catalogue

The furniture master shall be organized by functional area. Each category is configurable, and administrators may add, rename, deactivate or archive subcategories and products without a code deployment.

| Furniture Section | Product Categories | Representative Products | Key Procurement Attributes |
|---|---|---|---|
| Living Room | Sofas & Seating | 3-seater sofa, 2-seater sofa, sectional/L-sofa, recliner, accent chair, lounge chair, ottoman, sofa set | Material, upholstery, colour, seating capacity, dimensions, finish, warranty |
| Tables | Center / Coffee / Side / Console | Center table, coffee table, side table, nesting table, console table, end table | Length, width, height, material, finish, shape, top type |
| TV & Entertainment | TV Units & Media Storage | TV unit, media console, wall-mounted unit, entertainment cabinet | TV-size compatibility, dimensions, material, cable management, finish |
| Bedroom | Beds & Bed Frames | Single bed, queen bed, king bed, storage bed, hydraulic bed, bunk bed | Mattress size, outer dimensions, material, storage type, finish |
| Bedroom Storage | Wardrobes & Chests | 2-door wardrobe, 3-door wardrobe, sliding wardrobe, chest of drawers, dresser | Dimensions, doors, shelves, drawers, mirror, material, finish |
| Bedside & Dressing | Nightstands / Dressers | Bedside table, nightstand, dressing table, dresser, mirror cabinet | Dimensions, drawer count, mirror type, material, finish |
| Dining | Dining Sets | 4-seater, 6-seater, 8-seater dining table/set, benches | Seating capacity, table dimensions, tabletop material, chair material, finish |
| Dining Seating | Dining Chairs & Stools | Dining chair, bar stool, counter stool, bench | Height, upholstery, material, load capacity, finish |
| Study / Office | Work & Study Furniture | Study table, computer table, office desk, executive desk, workstation | Desk dimensions, storage, cable management, material, finish |
| Office Seating | Office Chairs | Task chair, executive chair, visitor chair, meeting chair | Chair type, upholstery, height adjustment, arms, wheel/base type |
| Storage | Cabinets & Shelving | Bookshelf, display unit, crockery cabinet, utility cabinet, filing cabinet | Dimensions, shelves, doors, lock, load capacity, material |
| Entryway | Entrance Furniture | Shoe rack, console, bench, key cabinet, storage bench | Capacity, dimensions, doors/drawers, material, finish |
| Kids Furniture | Children's Furniture | Kids bed, study table, study chair, toy storage, kids wardrobe, bunk bed | Age group, dimensions, safety features, material, finish |
| Outdoor / Patio | Outdoor Furniture | Patio chair, outdoor table, swing, bench, garden set | Material, weather resistance, dimensions, finish, assembly |
| Modular / Custom | Configured or Made-to-Order | Modular wardrobe, TV wall unit, modular storage, customized table/cabinet | Custom dimensions, drawing/reference image, material, laminate/finish, lead time |
| Furniture Accessories | Supporting Items | Cushions, chair pads, furniture covers, hardware kits, legs, handles | Size, material, compatibility, quantity, finish |

### 8.3.2 Furniture-Specific Purchase Order Fields

- Furniture Type / Category
- Brand Number, Brand Name and Brand Serial Number
- Product Serial Number, Product Code and SKU
- Material (wood / engineered board / metal / plastic / glass / mixed / custom)
- Finish / Surface / Upholstery
- Colour / Colour Family
- Dimensions: Length × Width × Height; depth where applicable
- Unit of Measure (piece, set, pair, unit, running foot where approved)
- Configuration / Variant / Model
- Assembly Required (Yes/No)
- Assembly Charges
- Delivery Lead Time
- Warranty / Guarantee Period
- Quantity
- Original Purchase Price
- Discount
- Margin
- Tax
- Additional Charges (freight, delivery, installation, assembly)
- Net / Final Value
- Dealer / Supplier
- Remarks and reference images/drawings

### 8.3.3 Furniture Quantity and Dimension Rules

- Furniture generally uses **piece / set / pair quantities** rather than clothing size matrices; however, configurable size or dimension variants must remain supported.
- When a furniture product has multiple dimensions or finishes, each unique variant must be entered as a separate line or variant combination.
- For **made-to-order items**, the purchase order must record the requested dimensions and attach a reference drawing/image when required.
- A product must **not be received into inventory** unless ordered quantity, accepted quantity and unit of measure are consistent.
- Delivery, installation and assembly charges must be recorded **separately from the base furniture purchase price** when they are supplier-billed.

### 8.3.4 Furniture Procurement Flow

```
SECTION ──► CATEGORY ──► PRODUCT ──► ATTRIBUTES
(Furniture &     (Living |     (Sofa | Bed |     (Material | Finish
 Home Interiors)  Bedroom |     Table | Chair |   Colour | Dimensions)
                  Dining |      Wardrobe |
                  Office |      Cabinet)
                  Storage)
                          │
        ┌─────────────────┼──────────────────┐
   QUANTITY         COMMERCIALS         SUPPLIER
   (Piece / Set /   (Price / Discount /  (Dealer / Delivery /
    Variant Qty)     Margin / Tax / Net)  Payment Terms)
        └─────────────────┼──────────────────┘
                          ▼
                   PO WORKFLOW
        Review → Approval → Issue → Receive →
        Inventory → Reports
```

### 8.3.5 BSC Exclusive Procurement Coverage Matrix

| Business Area | Included in Application | Example Products / Subcategories | Special Data Structure |
|---|---|---|---|
| Men's Wear | Yes | Shirts, T-shirts, trousers, jeans, ethnic wear, jackets, blazers, innerwear, accessories | S–XXXL / waist sizes / colour × size |
| Women's Wear | Yes | Kurtis, salwar sets, western wear, innerwear, blouses, accessories | S–XXXL / configurable |
| Sarees | Yes | Silk, chiffon, satin, tissue, jamdani, banarasi, brocade and other configurable sarees | Free size / fabric / pattern / colour / length |
| Jewellery | Yes | Necklaces, chains, earrings, bangles, bracelets, rings, pendants, sets | Free size / adjustable / numeric sizes / material / weight |
| Kids Wear | Yes | Boys, girls, infant, toddler, ethnic, western, footwear, accessories | Age group / size / colour |
| Toys | Yes | Educational, soft toys, ride-ons, dolls/action figures, games, baby toys | Age group / material / safety / quantity |
| Accessories | Yes | Belts, bags, watches, wallets, fashion accessories | Free size / model / colour |
| Home Furnishing | Yes | Bedsheets, blankets, curtains, towels, carpets, mats, cushions, table/sofa covers | Dimensions / material / pattern / colour / unit |
| Furniture & Home Interiors | **Added** | Sofas, beds, wardrobes, tables, dining sets, chairs, office furniture, cabinets, TV units, outdoor furniture and custom furniture | Dimensions / material / finish / assembly / warranty / delivery lead time |

## 8.4 Add / Edit / Activate / Archive / Delete Behaviour

| Operation | Behaviour |
|---|---|
| **Add Section** | Requires name, parent group, sizing method, display order and optional icon/image. |
| **Edit Section** | Changes configuration for future transactions while preserving historical transaction snapshots. |
| **Deactivate Section** | Removes it from new PO selection but preserves records. |
| **Archive Section** | Historical-safe retirement status. |
| **Delete Section** | Hard delete only if there are no dependencies or transactions; otherwise convert to archive. |
| **Lifecycle Logging** | Any lifecycle change must be audit logged with user, timestamp, division, previous state and new state. |

---

# 9. SIZE, COLOUR AND VARIANT MANAGEMENT

## 9.1 Size Methods

| Sizing Method | Examples | Typical Use |
|---|---|---|
| **Standard Apparel** | XS, S, M, L, XL, XXL, XXXL | Shirts, T-shirts, Kurtis, ethnic wear |
| **Numeric Waist** | 28, 30, 32, 34, 36, 38, 40, 42, 44 | Trousers and jeans |
| **Free Size** | Single Free Size quantity | Sarees, many jewellery items |
| **Age Group** | 0–2, 2–4, 4–6, 6–8, 8–10, 10–12, 12–14, 14–16 years | Kids |
| **Footwear UK** | 3–12 | Footwear |
| **Custom** | Admin-defined label/value list | Future sections |

## 9.2 Colour Master

- Maintain normalized colour names and codes.
- Support colour families and optional swatches.
- Allow **Other → manual colour entry**.
- Prevent spelling-based duplicates during creation.

## 9.3 Variant Matrix

For apparel the preferred PO entry mode is a **colour-by-size matrix**, e.g. Black → S/M/L/XL/XXL/XXXL quantities. The system must:

- Calculate **total units automatically**.
- Validate that the **sum of size quantities matches the stored total**.
- Provide a **running total** in the PO matrix.
- Support size-wise quantity capture as explicitly required.

---

# 10. PRODUCT AND BRAND MANAGEMENT

## 10.1 Brand Master

- **Brand Number:** unique business identifier.
- **Brand Name:** human-readable display name.
- **Brand Serial Number:** independent internal reference.
- **Brand Code:** short system code where required.
- Manufacturer and linked suppliers.
- Status and lifecycle dates.

## 10.2 Product Master

- **Product Serial Number:** system-generated unique reference.
- SKU and optional barcode.
- Product code, name and description.
- Brand references.
- Department, section, category and subcategory.
- Material/fabric, pattern, style, season, gender and age group where applicable.
- Tax category/HSN-SAC where applicable.
- Images and attachments.

## 10.3 Other Option / Progressive Catalogue

Brand, Product, Colour and Dealer selection must include an **Other** option where permitted. The Other workflow:

1. Opens an **inline form** rather than sending the user away from the PO.
2. Validates the manual entry.
3. Flags the entry as **custom data**.
4. Optionally **promotes** the entry into the corresponding master after submission/approval.

This progressive-catalogue approach is explicitly described in the supplied requirements.

---

# 11. DEALER / SUPPLIER MANAGEMENT

## 11.1 Dealer Master Fields

- Dealer ID and Dealer Code.
- Dealer/company name and contact person.
- Mobile, email and address.
- GSTIN and PAN where applicable.
- Division association (one or more divisions).
- Payment terms: **Advance, 30 Days, 60 Days, Against Delivery** or custom.
- Preferred brands/categories.
- Status, notes and internal rating.
- Optional bank details subject to permissions and future payment integration.

## 11.2 Dealer Ledger

- Total POs raised.
- Total ordered value.
- Total received value.
- Outstanding balance (when finance linkage is implemented).
- PO history and statuses.
- Delivery performance and quality metrics in future phases.

---

# 12. PURCHASE ORDER FUNCTIONAL REQUIREMENTS

## 12.1 PO Header

| Field Group | Required Data |
|---|---|
| **Identification** | PO Number, PO Date, Version/Revision, Status |
| **Organization** | Division, Department, Section |
| **Ownership** | Created By, Requesting User, Buyer |
| **Supplier** | Dealer Code, Dealer Name, Contact, Address |
| **Commercial** | Payment Terms, Delivery Terms, Currency, Tax Scheme |
| **Schedule** | Expected Delivery Date |
| **Control** | Approval Status, Created/Updated Timestamps |
| **Supporting Data** | Remarks, attachments, internal comments |

## 12.2 Guided PO Creation (Step-by-Step)

1. Authenticate user and resolve authorized division(s).
2. Select Division: Davanagere / Shivamogga / Belagavi or another division permitted by policy.
3. Select Department and active Section.
4. Select or add Dealer/Supplier.
5. Select Brand; use **Other** when necessary.
6. Select Product/Style; use **Other** when necessary.
7. Select Colour; use **Other** when necessary.
8. Enter size-wise or attribute-wise quantity.
9. Enter original purchase price and margin.
10. Apply discount; add tax/charges where configured.
11. Review system-calculated totals and commercial validation.
12. Save Draft or Submit for approval.

## 12.3 Product Entry Grid (Example)

| Product | Brand | Colour | S | M | L | XL | XXL | XXXL | Total |
|---|---|---|---|---|---|---|---|---|---|
| Formal Shirt | Brand A | Black | 5 | 10 | 12 | 10 | 6 | 2 | **45** |
| Formal Shirt | Brand A | White | 3 | 7 | 9 | 8 | 4 | 1 | **32** |

The grid must support: keyboard navigation, copy/duplicate row, add/remove row, live total calculation and validation. Different sections may use different matrix columns based on their configured sizing method.

---

# 13. PRICING, MARGIN, DISCOUNT, TAX AND CHARGES

## 13.1 Commercial Formula (from source)

```
Net Value        = Purchase Price + (Purchase Price × Margin %)
Discount Amount  = Net Value × Discount %  (or flat amount)
Final Value      = Net Value − Discount Amount
Line Total       = Final Value × Total Quantity
```

## 13.2 Calculation Reference

| Calculation | Formula |
|---|---|
| Gross Value | Purchase Price × Total Quantity |
| Margin Amount | Purchase Price × Margin % |
| Net Value / Selling Value per Unit | Purchase Price + Margin Amount |
| Discount Amount | Net Value × Discount % OR Flat Discount |
| Final Value per Unit | Net Value − Discount Amount |
| Line Total | Final Value per Unit × Total Quantity |
| Subtotal | Sum of line totals before order-level charges |
| Tax | Configured tax rule on applicable taxable base |
| Additional Charges | Freight + packing + transport + other configured charges |
| Grand Total | Subtotal − order-level discount + tax + charges |

## 13.3 Worked Example

| Field | Value |
|---|---|
| Brand / Product | Levi's – Men's Formal Shirt |
| Colour | Navy Blue |
| Size Qty | S10 / M20 / L20 / XL15 / XXL10 / XXXL5 = **80** |
| Purchase Price / Unit | ₹650.00 |
| Margin | 40% = ₹260.00 |
| Net Value / Unit | ₹910.00 |
| Discount | 10% = ₹91.00 |
| Final Value / Unit | ₹819.00 |
| **Line Total** | **₹65,520.00** |

> **Rule:** All calculation fields must be stored with appropriate monetary precision and recalculated **server-side**. The UI may preview the result, but the backend must remain authoritative.

---

# 14. APPROVAL AND GOVERNANCE WORKFLOW

The system must support **configurable approval levels**. Approval rules may depend on: PO value, division, department, section, dealer, category, discount or role.

**Example thresholds (configurable, not fixed):**

| PO Value | Approval Level |
|---|---|
| ₹0 – ₹25,000 | Admin Approval |
| ₹25,001 – ₹1,00,000 | Division Manager Approval |
| Above ₹1,00,000 | Super Admin Approval |

## 14.1 Approval Flow

```
PO Submitted → Approval Rule Evaluation → Level 1 Approver →
Approve / Reject / Send Back → Level 2 (if required) →
Final Approval → Issue PO
```

## 14.2 Approval Actions

- **Approve**
- **Reject** (reason mandatory)
- **Send Back / Request Changes** (comment mandatory)
- **Put on Hold**
- **Escalate** when configured

## 14.3 Approved PO Control

- Approved POs become **immutable** for ordinary editing.
- Any change requires an **amendment/version event**.
- Commercial changes may automatically trigger **re-approval**.
- Each version keeps the **previous version accessible**.

---

# 15. RECEIVING AND INVENTORY INTEGRATION

Receiving must operate against the **issued PO** and preserve ordered, received, rejected and pending quantities. **Partial receipt is a first-class state** rather than an exception.

## 15.1 Quantity States

| Quantity State | Meaning |
|---|---|
| **Ordered** | Original PO quantity |
| **Accepted Received** | Quantity accepted into inventory |
| **Damaged** | Physically received but not accepted into stock |
| **Rejected** | Not accepted against PO |
| **Pending** | Ordered minus accepted/rejected/closed handling as configured |

## 15.2 Receiving Flow

```
Issued PO → Goods Arrive → Verify Delivery →
Enter Received / Damaged / Rejected Qty → Create Receipt →
Update Inventory → Check Pending Qty →
Partial Receipt or Full Receipt → Close PO
```

## 15.3 Receipt Header

- Receipt Number
- PO Number
- Supplier
- Delivery date
- Invoice number/date where available
- Received by
- Division
- Remarks and attachments

## 15.4 Receipt Line

- Product/variant reference
- Ordered quantity
- Received quantity
- Damaged quantity
- Rejected quantity
- Accepted quantity
- Remarks

---

# 16. DASHBOARDS, REPORTING AND ANALYTICS

## 16.1 Super Admin Dashboard

- Total POs, pending approvals, approved, issued, partial and completed.
- Total quantity and total purchase value.
- Total discount and margin measures.
- Section, brand and dealer breakdown.
- Davanagere vs Shivamogga vs Belagavi comparison.
- Pending approval queue.
- Full enterprise audit activity.
- Drill-down into any division.

## 16.2 Domain Admin Dashboard

- Own-division POs and values.
- Pending approvals.
- Active sections and dealers.
- Section/brand spend.
- Size-curve analysis.
- Own-division audit history.

## 16.3 Reports Catalogue

| Report | Primary Dimensions |
|---|---|
| PO Register | PO, date, division, dealer, status, value |
| Purchase Summary | Division, department, section, period |
| Brand Report | Brand, product, quantity, value |
| Dealer Report | Dealer, POs, ordered/received value |
| Size Report | Product/brand/size quantity |
| Colour Report | Product/colour quantity |
| Discount Report | PO, dealer, discount type/value |
| Margin Report | Product, section, division, margin |
| Approval Ageing | PO, approver, submitted date, pending duration |
| Receiving Report | Ordered vs received vs pending |
| Audit Report | User, action, timestamp, before/after |
| Amendment Report | PO version history |

## 16.4 Transaction-to-Reporting Flow

```
Transactions → Master Data → Receipts → Audit Events →
Aggregation Engine → Division / Section / Brand / Dealer Filters →
KPI Dashboard → Operational Reports → Excel / CSV / PDF Export
```

---

# 17. AUDIT TRAIL, HISTORY AND DOCUMENT MANAGEMENT

Every critical action must be logged in an **immutable audit stream**. All edits, section changes, master additions and commercial edits must be visible to the appropriate administrators.

## 17.1 Audit Event Fields

| Audit Field | Description |
|---|---|
| Event ID | Unique audit event identifier |
| Timestamp | Exact date/time |
| User + Role | Actor and resolved role |
| Division + Section | Business scope |
| Action Type | Create/Edit/Delete/Approve/Receive/etc. |
| Record Type + ID | Target entity |
| Before Value | Previous value where changed |
| After Value | New value where changed |
| Reason / Comment | Justification for sensitive action |
| Request/Correlation ID | Technical trace for API/server diagnostics |

## 17.2 Attachments and Comments

- Quotation attachments
- Supplier documents
- Invoice or delivery proof
- Product/reference images
- Approval notes
- Internal comments with user and timestamp

## 17.3 PO Timeline

Each PO should show a chronological timeline:

> **Created → Submitted → Reviewed → Approved → Issued → Receipt 1 → Receipt 2 → Closed**

…with actor, timestamp and action details.

---

# 18. NOTIFICATIONS AND COMMUNICATION

| # | Notification Event |
|---|---|
| 1 | PO submitted for approval |
| 2 | Approval pending |
| 3 | PO approved |
| 4 | PO rejected/send back |
| 5 | PO issued |
| 6 | Delivery due/overdue |
| 7 | Partial receipt |
| 8 | Full receipt |
| 9 | High-value or high-discount alert |
| 10 | Master-data creation awaiting authorization where configured |

**Phase 1:** in-app and email notifications. **Future phases:** SMS/WhatsApp and vendor portal communications.

---

# 19. UI/UX AND SCREEN SPECIFICATIONS

## 19.1 Main Navigation

- **Dashboard**
- **Purchasing** → Purchase Orders / Approvals / Receiving
- **Masters** → Divisions / Departments / Sections / Brands / Products / Sizes / Colours / Dealers
- **Inventory**
- **Reports**
- **Administration** → Users / Roles / Audit Logs / Settings

## 19.2 Key Screens

| Screen | Primary Components | Key Actions |
|---|---|---|
| Login | Credentials, reset, MFA option | Sign in, reset password |
| Division Selection | Authorized division cards/list | Select division |
| Dashboard | KPIs, charts, activity | Drill down, filter |
| Section Management | Tree/list, Add Section | Create/edit/archive/configure |
| Brand/Product Masters | Searchable tables + forms | CRUD, import, export |
| PO Create | Guided stepper + matrix | Add lines, calculate, save, submit |
| PO Details | Tabs: overview/products/approval/receiving/history | View, approve, amend, receive |
| Approval Queue | Pending cards/table | Approve/reject/send back |
| Receiving | PO selector + receipt grid | Record receipt |
| Reports | Filters, tables, charts | Export |
| Users & Roles | Users, scopes, permissions | Create/assign/deactivate |
| Audit Logs | Immutable event table | Filter, export, drill into record |

## 19.3 UX Standards

- Desktop-first, tablet-friendly, responsive mobile fallback.
- Searchable dropdowns and type-ahead.
- Fast matrix entry for quantities.
- Keyboard navigation for high-volume entry.
- Sticky totals and validation.
- Explicit confirmation for destructive actions.
- Clear status chips and workflow indicators.
- **No inaccessible dead buttons or fake dashboard metrics.**

---

# 20. DATA MODEL AND DATABASE REQUIREMENTS

The database shall be **normalized enough to prevent duplication** while retaining transaction snapshots so that historical PO documents do not change when master records are updated later.

## 20.1 Core Entities and Relationships

| Entity | Important Relationships |
|---|---|
| users | roles, user_divisions, departments |
| roles | permissions, users |
| divisions | departments, sections, users, POs |
| departments | sections, products |
| sections | categories, sizing methods, attributes, POs |
| categories | products |
| brands | products, suppliers |
| products | brand, section, variants |
| product_variants | product, size, colour |
| sizes | size methods, variants |
| colours | variants |
| suppliers | brands, divisions, POs |
| purchase_orders | division, supplier, user, approvals, receipts |
| purchase_order_items | PO, product/variant, quantity, pricing |
| approvals | PO, approver, approval level |
| receipts | PO, receipt lines |
| inventory_transactions | product variant, receipt, division |
| notifications | user, entity/event |
| attachments | entity reference |
| audit_logs | actor, target entity, before/after |

## 20.2 Suggested Table Set

- `users`, `roles`, `permissions`, `user_roles`, `user_divisions`
- `divisions`, `departments`, `sections`, `categories`, `section_attributes`
- `brands`, `products`, `product_variants`, `sizes`, `size_methods`, `colours`
- `suppliers`, `supplier_brands`
- `purchase_orders`, `purchase_order_items`, `purchase_order_quantities`
- `purchase_order_discounts`, `purchase_order_taxes`, `purchase_order_charges`
- `approval_rules`, `approval_levels`, `approval_instances`
- `receipts`, `receipt_items`, `inventory_transactions`
- `notifications`, `attachments`, `comments`, `audit_logs`
- `number_sequences`, `settings`, `import_jobs`, `export_jobs`

## 20.3 Historical Snapshot Principle

At **approval/issue time**, the PO should preserve the relevant display values (brand name, product name, colour label, size label, dealer information and commercial values) in **transactional snapshots**. Master data may evolve later, but historical PO documents must remain reproducible.

---

# 21. API AND INTEGRATION REQUIREMENTS

## 21.1 Domain Endpoint Map

| Domain | Representative Endpoints |
|---|---|
| Authentication | `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/reset` |
| Users/Roles | `/api/users`, `/api/roles`, `/api/permissions` |
| Organization | `/api/divisions`, `/api/departments`, `/api/sections` |
| Catalogue | `/api/brands`, `/api/products`, `/api/categories`, `/api/sizes`, `/api/colours` |
| Suppliers | `/api/suppliers`, `/api/suppliers/:id/history` |
| Purchasing | `/api/purchase-orders`, `/api/purchase-orders/:id`, `/api/purchase-orders/:id/submit` |
| Approvals | `/api/approvals`, `/api/approvals/:id/approve`, `/reject`, `/send-back` |
| Receiving | `/api/receipts`, `/api/receipts/:id` |
| Inventory | `/api/inventory/transactions`, `/api/inventory/balances` |
| Reports | `/api/reports/*` |
| Audit | `/api/audit-logs` |
| Notifications | `/api/notifications` |

## 21.2 API Standards

- Use pagination, filtering and sorting on list APIs.
- Return consistent error structures.
- **Authorize every endpoint server-side.**
- Use idempotency for sensitive create operations where appropriate.
- Protect number sequence generation from race conditions.
- Provide API versioning for future external integrations.

---

# 22. SECURITY REQUIREMENTS

1. Passwords must be securely hashed; never stored in plaintext.
2. HTTPS required in production.
3. Input validation and output encoding.
4. Protection against SQL injection, XSS, CSRF where applicable and insecure direct object references.
5. Rate limiting on authentication and sensitive endpoints.
6. Least-privilege role and division access.
7. Audit logging of privileged operations.
8. Re-authentication/step-up verification for high-risk actions where configured.
9. File-upload validation, size/type limits and malware scanning strategy.
10. Secrets stored outside source code in secure environment configuration.
11. Session expiration and revocation.
12. No client-supplied calculation may be trusted without backend recomputation.

---

# 23. NON-FUNCTIONAL REQUIREMENTS

| Area | Requirement |
|---|---|
| **Performance** | Dashboard and common list operations should be responsive; source target is consolidated trailing-12-month dashboard load within about 3 seconds. |
| **Availability** | Production deployment should use monitoring, health checks and backup/recovery procedures. |
| **Scalability** | Support growth in divisions, products, brands, dealers and PO history without redesign. |
| **Usability** | Guided PO flow, type-ahead searches, matrix entry and clear validation. |
| **Data Integrity** | Foreign keys, unique constraints, transactional operations and server-side calculation. |
| **Auditability** | Immutable audit event recording for critical operations. |
| **Accessibility** | Clear labels, keyboard navigation, readable contrast, usable error messages. |
| **Maintainability** | Modular domain services, reusable components, configuration-driven rules. |
| **Observability** | Application logs, API error logs, background job logs and security events. |

---

# 24. BUSINESS RULES AND VALIDATION RULES

| Rule ID | Rule |
|---|---|
| **RB-001** | User may access only divisions granted by authorization policy. |
| **RB-002** | Only active divisions, departments and sections may be selected for new POs. |
| **RB-003** | Historical POs must remain readable after section or master-data retirement. |
| **RB-004** | Product serial number and SKU uniqueness must be enforced according to configured scope. |
| **RB-005** | Brand number and brand serial number must not be conflated. |
| **RB-006** | Total quantity equals the sum of configured variant quantities. |
| **RB-007** | Quantity cannot be negative; zero quantity lines are invalid unless explicitly used for template scenarios. |
| **RB-008** | Purchase price cannot be negative. |
| **RB-009** | Discount cannot exceed allowed policy without exception approval. |
| **RB-010** | Margin cannot exceed configured policy without permission/approval. |
| **RB-011** | Approved POs are not directly editable. |
| **RB-012** | Rejection and send-back actions require reasons/comments. |
| **RB-013** | Receipt quantities must reconcile with PO ordered quantities. |
| **RB-014** | A section with transaction history is archived/soft-deleted rather than physically erased. |
| **RB-015** | All critical state transitions are audit logged. |
| **RB-016** | Other/manual values must be visibly flagged as custom until promoted to controlled master data. |
| **RB-017** | Financial totals must be recalculated server-side before persistence/approval. |
| **RB-018** | Division-scoped reports must not leak cross-division data. |

---

# 25. EXCEPTION AND EDGE-CASE HANDLING

| Scenario | Expected Behaviour |
|---|---|
| Duplicate brand found | Warn, show matching records, prevent duplicate where unique key matches |
| Duplicate product serial/SKU | Hard validation error unless controlled exception policy exists |
| Section has history and user clicks delete | Offer archive/deactivate instead of hard delete |
| User loses session during PO | Autosave draft where feasible; require re-authentication on resume |
| Approval rule unavailable | Do not issue PO; route to configured fallback or Super Admin exception queue |
| Supplier becomes inactive after draft | Existing draft remains readable, but new submission requires active supplier or authorized override |
| Partial delivery | Create receipt and keep PO Partially Received |
| Over-receipt | Block or require approved over-receipt exception |
| Price changes after draft | Recalculate and record change; approval rule may restart |
| Network interruption on submit | Use idempotent submission to avoid duplicate PO creation |
| Import file contains errors | Reject invalid rows, provide row-level error report, do not silently insert |

---

# 26. TESTING AND ACCEPTANCE CRITERIA

## 26.1 Test Categories

1. Unit tests for calculations, validation and business rules.
2. Integration tests for PO → approval → receipt → inventory.
3. API contract tests for protected endpoints.
4. UI workflow tests for core screens.
5. Security tests for role and division bypass attempts.
6. Import/export tests.
7. PDF generation tests.
8. Performance tests for dashboard and large catalogue searches.
9. Regression tests for section/configuration changes.

## 26.2 Key Acceptance Scenarios

| # | Scenario |
|---|---|
| TC-01 | Create a user and assign a role and division. |
| TC-02 | Login and verify only authorized division(s) are visible. |
| TC-03 | Add/edit/archive a section without code deployment. |
| TC-04 | Configure S–XXXL sizes and confirm the matrix updates automatically. |
| TC-05 | Create a brand with separate brand number, name and brand serial number. |
| TC-06 | Create a product with product serial number and variant definitions. |
| TC-07 | Use Other for brand/product/colour/dealer and verify controlled promotion behaviour. |
| TC-08 | Create a multi-line PO with colour × size quantities. |
| TC-09 | Apply margin and discount and verify server-side calculations. |
| TC-10 | Route a high-value PO to the correct approval level. |
| TC-11 | Reject/send back a PO and verify reason capture. |
| TC-12 | Approve and issue the PO; generate PDF. |
| TC-13 | Partially receive a PO and verify remaining quantity. |
| TC-14 | Fully receive the PO and verify close/receipt state. |
| TC-15 | Confirm dashboards and reports reflect the transaction. |
| TC-16 | Confirm audit log contains user, time, action and before/after values. |

---

# 27. IMPLEMENTATION PHASES AND DELIVERY PLAN

| Phase | Scope | Exit Criteria |
|---|---|---|
| **Phase 0 — Discovery** | Finalize master data policy, approval policy, identifiers, UI prototypes | Signed-off business rules and UX |
| **Phase 1 — Core Foundation** | Auth, roles, divisions, sections, masters, PO engine | Core PO lifecycle works end-to-end |
| **Phase 2 — Governance** | Approvals, audit, amendments, notifications, PDF | Governed PO process production-ready |
| **Phase 3 — Receiving** | Receipts, partial receiving, inventory transactions | Receipt lifecycle reconciles to PO |
| **Phase 4 — Analytics** | Dashboards, reports, exports, drill-down | Management reporting validated |
| **Phase 5 — Hardening** | Security, performance, backup, observability, UAT | Production readiness sign-off |
| **Phase 6 — Optional Extensions** | Vendor portal, barcode, auto-replenishment, accounting/ERP integrations | Prioritized enhancements delivered separately |

## 27.1 Administration & Configuration Flow

```
Super Admin Login → Manage Users & Roles → Manage Divisions →
Manage Departments → Manage Sections → Define Attributes / Sizes / Colours →
Manage Brands & Products → Manage Dealers → Configure Approval Rules →
Configure Numbering / Settings → Monitor Audit Logs → Review Reports
```

---

# 28. DEPLOYMENT, BACKUP AND OPERATIONS

- Separate Development, Staging and Production environments.
- HTTPS and secure DNS in production.
- Environment variables for secrets/configuration.
- Database backup schedule with tested restore procedure.
- At least **30-day backup retention** as the source baseline.
- Monitoring for application health, database health, API errors and background jobs.
- Controlled schema migrations.
- Centralized logs and alerting.
- Disaster recovery runbook and periodic restore test.

---

# 29. FUTURE ENHANCEMENTS AND MARKET BENCHMARK FEATURES

The uploaded requirements benchmark the solution against apparel and retail procurement systems and identify future-facing features such as size-curve matrices, digital vendor confirmation, barcode/SKU generation, GST-compliant invoicing, vendor portals, auto-replenishment, real-time PO status and multi-outlet reporting. The source recommends prioritizing **core workflow first** and scheduling vendor portal, barcode generation and auto-replenishment after stabilization.

**Furniture extension note:** the procurement architecture is intentionally generic enough to support both **stocked furniture** and **made-to-order/custom furniture**, including dimension capture, reference drawings, delivery/installation charges, warranty details and variant-based pricing.

| Future Feature | Business Value | Recommended Phase |
|---|---|---|
| Vendor Portal | Dealer can view/confirm/reject PO and proposed changes | Phase 2+ |
| Barcode/SKU Generation | Automated style-colour-size identification | Phase 2+ |
| Supplier Quotation Comparison | Compare supplier offers before PO | Phase 2+ |
| Price History | Historical purchase price trend by product/dealer | Phase 2+ |
| Supplier Ranking | Delivery, quality and price scoring | Phase 2+ |
| Auto Replenishment | Suggested reorder quantities from stock/sales | Phase 3+ |
| Three-Way Matching | PO vs receipt vs invoice | Phase 3+ |
| Accounting / ERP Integration | Financial posting and reconciliation | Phase 3+ |
| Native Mobile App | On-the-go approvals and PO review | Later |
| Advanced Forecasting | Seasonality and demand prediction | Later |

---

# 30. GLOSSARY

| Term | Definition |
|---|---|
| **Division** | Operating branch such as Davanagere, Shivamogga or Belagavi. |
| **Department** | High-level merchandise group such as Men's, Women's or Kids. |
| **Section** | Configurable purchasing category such as Men's Shirts or Sarees. |
| **Variant** | Specific combination of product attributes such as colour and size. |
| **Brand Number** | Business identifier for a brand. |
| **Brand Serial Number** | Internal reference distinct from the brand number and name. |
| **Product Serial Number** | Unique identifier assigned to a product. |
| **PO** | Purchase Order issued to a supplier/dealer. |
| **Net Value** | Purchase price plus configured margin before discount under the supplied formula. |
| **Final Value** | Net value after discount. |
| **Domain Admin** | Administrator responsible for a defined division scope. |
| **Super Admin** | Head-office role with enterprise-wide access. |
| **Receipt** | Transaction recording goods received against a PO. |
| **Audit Log** | Immutable record of important system activity and changes. |

---

# 31. FINAL END-TO-END FLOW

## 31.1 Purchase Order Lifecycle

```
Draft → Submitted → Under Review → Approved →
Issued → Partially Received → Received → Closed
```

## 31.2 Complete Operating Flow

> **Login → Role/Permission Validation → Division → Department → Section → Brand/Product/Colour → Size/Quantity → Purchase Price → Margin → Discount → Dealer → Review → Draft/Submit → Approval → Issue PO → PDF/Print → Goods Receipt → Inventory Update → Dashboard/Reports → Audit History**

This is consistent with the core workflow described in the supplied project requirements.

---

# APPENDIX A — SCREEN INVENTORY

| # | Screen |
|---|---|
| 1 | Login |
| 2 | Forgot Password / Reset Password |
| 3 | Division Selection |
| 4 | Super Admin Dashboard |
| 5 | Domain Admin Dashboard |
| 6 | Purchase Dashboard |
| 7 | PO List |
| 8 | PO Create |
| 9 | PO Edit Draft |
| 10 | PO Details |
| 11 | Approval Queue |
| 12 | Receipt List |
| 13 | Receipt Create |
| 14 | Section Management |
| 15 | Department Management |
| 16 | Category Management |
| 17 | Brand Management |
| 18 | Product Management |
| 19 | Size Management |
| 20 | Colour Management |
| 21 | Dealer/Supplier Management |
| 22 | User Management |
| 23 | Role & Permissions |
| 24 | Notifications |
| 25 | Reports |
| 26 | Audit Logs |
| 27 | Settings |
| 28 | Import Wizard |
| 29 | Export Center |

---

# APPENDIX B — SUGGESTED API INVENTORY

| # | Endpoint |
|---|---|
| 1 | POST /api/auth/login |
| 2 | POST /api/auth/logout |
| 3 | POST /api/auth/refresh |
| 4 | GET /api/me |
| 5 | GET/POST/PATCH /api/users |
| 6 | GET/POST/PATCH /api/divisions |
| 7 | GET/POST/PATCH /api/departments |
| 8 | GET/POST/PATCH /api/sections |
| 9 | GET/POST/PATCH /api/categories |
| 10 | GET/POST/PATCH /api/brands |
| 11 | GET/POST/PATCH /api/products |
| 12 | GET/POST/PATCH /api/sizes |
| 13 | GET/POST/PATCH /api/colours |
| 14 | GET/POST/PATCH /api/suppliers |
| 15 | GET/POST /api/purchase-orders |
| 16 | GET/PATCH /api/purchase-orders/{id} |
| 17 | POST /api/purchase-orders/{id}/submit |
| 18 | POST /api/purchase-orders/{id}/approve |
| 19 | POST /api/purchase-orders/{id}/reject |
| 20 | POST /api/purchase-orders/{id}/send-back |
| 21 | POST /api/purchase-orders/{id}/amend |
| 22 | GET/POST /api/receipts |
| 23 | GET /api/inventory/* |
| 24 | GET /api/reports/* |
| 25 | GET /api/audit-logs |
| 26 | GET /api/notifications |

---

# APPENDIX C — SAMPLE PO DATA STRUCTURE

```
PurchaseOrder
├── poNumber
├── divisionId
├── departmentId
├── sectionId
├── supplierId
├── status
├── approvalStatus
├── commercialSummary
│   ├── subtotal
│   ├── discount
│   ├── tax
│   ├── charges
│   └── grandTotal
└── lines[]
    ├── brandId / brandSnapshot
    ├── productId / productSnapshot
    ├── colourId / colourSnapshot
    ├── variantQuantities[]
    │   ├── sizeId / sizeLabel
    │   └── quantity
    ├── purchasePrice
    ├── marginPercent
    ├── marginAmount
    ├── netValue
    ├── discountType
    ├── discountAmount
    └── lineTotal
```

---

# APPENDIX D — IMPLEMENTATION DEFINITION OF DONE

- All required modules are implemented and connected to persistent data.
- No critical workflow uses placeholder/mock data in production mode.
- Frontend and backend permission checks are aligned.
- Server-side financial calculations match approved formulas.
- Approved PO versioning is implemented.
- Receipt quantities reconcile correctly.
- Audit entries are generated and queryable.
- PDF generation is stable.
- Import/export validations are complete.
- Critical test suite passes.
- Security review and UAT are completed.
- Backup and restore procedures are documented and tested.

---

# FINAL PROJECT STATEMENT

This document is intended to act as the **authoritative build blueprint** for the Purchase Order and Merchandise Procurement Management System, including BSC Exclusive furniture and lifestyle procurement. The application should be implemented as a **configurable enterprise platform** rather than as a set of hard-coded category pages. The core architecture must support:

- The three current divisions (Davanagere, Shivamogga, Belagavi)
- Approximately 18 initial sections with dynamic future sections
- Product variants, size/colour matrices
- Commercial calculations
- Dealer management
- Approval governance
- Receiving and inventory integration
- Dashboards, reporting and auditability
- Future ERP/vendor integrations

## Publicly Identified BSC Category Mapping

| Publicly Identified BSC Category | Evidence / Meaning | System Treatment |
|---|---|---|
| Men's Wear | Official company site identifies men's wear / Men's Xpress formats. | Department > Men's; full brand/product/variant master. |
| Women's / Ladies Wear | Official company site identifies dedicated ladies spaces. | Department > Women's; apparel + saree + accessories. |
| Kids Wear | Official company site identifies dedicated kids spaces. | Department > Kids; age/size matrices. |
| Sarees | Public BSC listings identify sarees and multiple saree types. | Women's > Sarees; fabric/pattern/colour/length fields. |
| Jewellery / Accessories | System requirement includes jewellery; public listings also identify accessories. | Women's / Accessories with configurable attributes. |
| Toys | A public BSC Exclusive description identifies toys. | Kids > Toys; age group, material, quantity, safety/document fields. |
| Home Furnishings | Official company information and local public descriptions identify home furnishings. | Home > Home Furnishing; textile and decor product attributes. |

---

**Confidential — Internal Project Documentation | Version 2.0**

---

✅ **Your complete detailed document is ready above.** It covers all 31 sections + 4 appendices of the PO Management System specification, including the full BSC furniture & lifestyle catalogue, pricing formulas with worked example, approval thresholds, 18 business rules, 11 edge cases, 16 test scenarios, and the 7-phase delivery plan.

Would you like me to also:
1. **Convert this into a specific format** (Word/DOCX structure, Confluence wiki, or plain text)?
2. **Generate the SQL schema** for the suggested table set in Section 20?
3. **Create detailed use cases / user stories** per role for development handoff?
4. **Draft the Phase 1 build plan** with week-by-week tasks?