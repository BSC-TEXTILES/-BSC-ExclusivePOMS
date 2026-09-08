// Jira CSV import generator — Part 3 user stories (31 stories, 8 roles) + 2 system epics + subtasks.
// Run: node generate-csv.js  →  writes user-stories.csv next to this file.
// Import: Jira → Issues → Import issues from CSV. Map: Summary, Issue Type, Description,
//         Priority, Labels, Epic Name, Epic Link, Story Points.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const EPICS = [
  { key: 'SYS-01', name: 'Server-side Commercial Engine', summary: 'SYS-01: Server-side commercial engine (RB-017, §13)', description: 'Server-side engine recomputes all monetary totals before persist/approve; UI values are advisory only.', priority: 'Highest', points: 8 },
  { key: 'SYS-02', name: 'Historical Snapshot Engine', summary: 'SYS-02: Historical snapshot engine (§20.3, RB-003)', description: 'Snapshot engine freezes brand/product/colour/size/dealer display values into every PO at approval/issue; masters may evolve freely afterwards.', priority: 'Highest', points: 5 },
];

const STORIES = [
  // Super Admin
  { id: 'SA-01', role: 'Super Admin', must: 'Must', trace: '§5, §6, RB-001', points: 5, story: 'create divisions and assign Domain Admins to them', so: 'each branch operates in a controlled scope', ac: 'Given I am Super Admin, when I create division "Belagavi" with a unique code, then it appears active and selectable only for assigned users. Cross-division access returns 403 and is audit-logged.' },
  { id: 'SA-02', role: 'Super Admin', must: 'Must', trace: '§14', points: 5, story: 'configure approval rules by value/division/section/dealer/discount thresholds', so: 'governance adapts without code changes', ac: 'Given rule "₹25,001–₹1,00,000 → Division Manager", when a PO of ₹80,000 is submitted, then it routes to Division Manager only.' },
  { id: 'SA-03', role: 'Super Admin', must: 'Must', trace: '§16.1, SC-7', points: 5, story: 'get one consolidated dashboard across all 3 divisions with drill-down', so: 'I get enterprise-wide visibility', ac: 'KPIs aggregate all divisions; clicking a division filters without reload; load < 3s (§23).' },
  { id: 'SA-04', role: 'Super Admin', must: 'Must', trace: '§6.2', points: 3, story: 'manage users, force password resets and deactivate accounts', so: 'access stays current', ac: 'Deactivated users cannot authenticate; forced-reset flags demand a new password at next login.' },
  { id: 'SA-05', role: 'Super Admin', must: 'Must', trace: '§17, RB-015', points: 5, story: 'have a filterable, exportable enterprise audit log with before/after values', so: 'I can verify accountability', ac: 'Every critical change shows actor, timestamp, before/after; audit rows cannot be updated or deleted even at DB level.' },
  { id: 'SA-06', role: 'Super Admin', must: 'Should', trace: '§25', points: 3, story: 'have an exception queue for POs whose approval rule evaluation fails', so: 'procurement never silently stalls', ac: 'Given no matching rule, when a PO is submitted, then it appears in the Super Admin exception queue and is not issuable until actioned.' },
  // Domain Admin
  { id: 'DA-01', role: 'Domain Admin', must: 'Must', trace: '§8.4, TC-03', points: 5, story: 'add/edit/activate/deactivate/archive sections for my division', so: 'the catalogue evolves without code deployment', ac: 'Given a section with transaction history, when I click Delete, then Archive/Deactivate is offered instead (RB-014).' },
  { id: 'DA-02', role: 'Domain Admin', must: 'Must', trace: '§11.1', points: 3, story: 'manage dealers (create, payment terms, division assignment)', so: 'purchasing always has valid suppliers', ac: 'Given an inactive supplier, new PO selection is blocked; existing drafts remain readable (§25).' },
  { id: 'DA-03', role: 'Domain Admin', must: 'Must', trace: '§16.2', points: 5, story: 'have a division dashboard (POs, values, pending approvals, section spend)', so: 'I can manage branch procurement', ac: 'Only own-division data is visible (RB-018); pending approvals link to the decision view.' },
  { id: 'DA-04', role: 'Domain Admin', must: 'Should', trace: '§25, App A #28', points: 5, story: 'import master data via wizard with row-level error reports', so: 'bulk setup is safe', ac: 'Given a file with 3 invalid rows, valid rows are staged, errors listed with row numbers, nothing inserts silently.' },
  { id: 'DA-05', role: 'Domain Admin', must: 'Must', trace: '§8.4, RB-015', points: 2, story: 'have section lifecycle changes audit-logged automatically', so: 'history is provable', ac: 'Every add/edit/activate/archive writes an audit event with user, timestamp, previous and new state.' },
  // Purchase Executive
  { id: 'PE-01', role: 'Purchase Executive', must: 'Must', trace: '§12.2', points: 8, story: 'use a guided PO creation flow scoped to my division', so: 'I cannot enter invalid combinations', ac: 'Steps enforce division → department → active section → supplier → product → quantities ordering; inactive masters are not selectable (RB-002).' },
  { id: 'PE-02', role: 'Purchase Executive', must: 'Must', trace: '§10.3, TC-07', points: 5, story: 'use an inline "Other" form for Brand/Product/Colour/Dealer', so: 'I am never blocked by a missing master entry', ac: 'Inline form validates, visibly flags custom entries (RB-016) and optionally promotes to master — no navigation away.' },
  { id: 'PE-03', role: 'Purchase Executive', must: 'Must', trace: '§9.3, §12.3, SC-6', points: 8, story: 'have a colour × size matrix with running totals and keyboard navigation', so: 'large apparel orders are entered fast', ac: 'Given Standard Apparel sizing, columns S–XXXL render; entering 5/10/12/10/6/2 shows live total 45 = stored total (RB-006); Tab moves cell-to-cell.' },
  { id: 'PE-04', role: 'Purchase Executive', must: 'Should', trace: '§25', points: 3, story: 'have draft autosave and resume after re-login', so: 'long entries survive interruptions', ac: 'After session loss and re-auth, the draft is intact; commercials re-confirmed before submit.' },
  { id: 'PE-05', role: 'Purchase Executive', must: 'Must', trace: '§12.2 step 12, §25', points: 3, story: 'submit a completed draft for approval', so: 'procurement proceeds', ac: 'Submit is idempotent — a network retry never creates duplicate POs; status becomes submitted with notifications.' },
  // Purchase Manager
  { id: 'PM-01', role: 'Purchase Manager', must: 'Must', trace: '§6.1, RB-009/010', points: 5, story: 'create/edit POs with commercial details within policy', so: 'I own division purchasing', ac: 'Given policy caps discount at 15%, entering 20% blocks or routes to exception approval per configuration (RB-009).' },
  { id: 'PM-02', role: 'Purchase Manager', must: 'Must', trace: '§14.3, RB-011', points: 5, story: 'amend an approved/issued PO via a version event', so: 'changes are governed, not silent', ac: 'Editing a line on an approved PO creates version 2, snapshots the previous version and re-runs approval routing.' },
  { id: 'PM-03', role: 'Purchase Manager', must: 'Must', trace: '§12.2 step 11, RB-017', points: 3, story: 'see a pre-submit review with server-calculated totals and validation results', so: 'errors are caught early', ac: 'Review screen shows recomputed totals and all rule violations before submit is possible.' },
  // Approver
  { id: 'AP-01', role: 'Approver', must: 'Must', trace: '§19.2, §16', points: 3, story: 'have a pending-approval queue sorted by age and value', so: 'I triage effectively', ac: 'Queue lists open instances at my level, oldest first, with value and rule context.' },
  { id: 'AP-02', role: 'Approver', must: 'Must', trace: '§14.2', points: 5, story: 'Approve / Reject / Send Back / Hold / Escalate', so: 'all governance paths exist', ac: 'Reject without reason is blocked in UI and API and by DB constraint (RB-012); approval advances levels; final approval unlocks issue.' },
  { id: 'AP-03', role: 'Approver', must: 'Must', trace: '§17.3', points: 3, story: 'see full PO detail (lines, matrix, commercials, timeline) in the decision view', so: 'I can judge commercial merit', ac: 'Timeline shows Created → Submitted → Reviewed… with actor + timestamp per event.' },
  // Receiving User
  { id: 'RC-01', role: 'Receiving User', must: 'Must', trace: '§15', points: 5, story: 'create a receipt against an issued PO selecting lines', so: 'goods receipt is tied to the exact order', ac: 'Only issued/partially-received POs are receivable; receipt stores invoice and delivery metadata.' },
  { id: 'RC-02', role: 'Receiving User', must: 'Must', trace: '§15.1/15.4', points: 5, story: 'record Received/Damaged/Rejected per line with Accepted auto-computed', so: 'the 5-quantity model stays consistent', ac: 'Given ordered 80, received 70 / damaged 5 / rejected 5 → Accepted 60, inventory increases by 60.' },
  { id: 'RC-03', role: 'Receiving User', must: 'Must', trace: '§25', points: 3, story: 'have over-receipt blocked', so: 'inventory never exceeds order without authorization', ac: 'Given pending 10, receiving 15 is blocked with a clear message (RB-013).' },
  { id: 'RC-04', role: 'Receiving User', must: 'Must', trace: '§31.1, RB-013', points: 3, story: 'see the PO auto-transition Partially Received → Received → Closed', so: 'status is always accurate', ac: 'All pending zero after posting → Received; partial keeps Partially Received; manual close available.' },
  // Viewer
  { id: 'VW-01', role: 'Viewer', must: 'Must', trace: '§6.1, RB-018', points: 2, story: 'use read-only dashboards and reports scoped to my assignment', so: 'I get insight without write risk', ac: 'Any write endpoint returns 403; reports show only division-scoped rows.' },
  { id: 'VW-02', role: 'Viewer', must: 'Should', trace: '§16.4', points: 2, story: 'export visible reports to CSV/Excel/PDF', so: 'I can share analysis', ac: 'CSV export produces the same filtered dataset the viewer can see, nothing more.' },
  // Auditor
  { id: 'AU-01', role: 'Auditor', must: 'Must', trace: '§17.1, SC-8', points: 3, story: 'have read-only audit logs with before/after JSON, user, role, timestamp', so: 'any change is reconstructable', ac: 'Every field change shows old → new with actor and timestamp; UPDATE/DELETE on audit rows is impossible at DB level.' },
  { id: 'AU-02', role: 'Auditor', must: 'Must', trace: '§14.3', points: 3, story: 'see PO version history side-by-side', so: 'amendments are reviewable', ac: 'Version chain v1→v2 lists each version with totals and status.' },
  { id: 'AU-03', role: 'Auditor', must: 'Should', trace: '§16.3', points: 2, story: 'export audit findings', so: 'evidence packs can be produced', ac: 'Audit export yields CSV with all filters applied.' },
];

const esc = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
const rows = [[
  'Summary', 'Issue Type', 'Description', 'Priority', 'Labels', 'Epic Name', 'Epic Link', 'Story Points',
]];

for (const e of EPICS) {
  rows.push([e.summary, 'Epic', e.description, e.priority, 'poms,system', e.name, '', String(e.points)]);
  rows.push([`Sub-task: Engine unit tests vs FRS §13.3 worked example (${e.key})`, 'Sub-task', `Property-based tests: Levi's ₹650/40%/10%/80 must equal ₹65,520.00 exactly. Trace: ${e.key}.`, 'High', 'poms,qa', '', e.name, '']);
  rows.push([`Sub-task: Persistence + recompute integration test (${e.key})`, 'Sub-task', `Persisted values equal recomputed engine output; UI-supplied totals are ignored. Trace: ${e.key}.`, 'High', 'poms,qa', '', e.name, '']);
}

for (const s of STORIES) {
  const epic = 'SYS Epic — trace only';
  const summary = `${s.id}: As a ${s.role}, I want to ${s.story}, so that ${s.so}`;
  const description = `Acceptance criteria: ${s.ac}\nTrace: ${s.trace} | MoSCoW: ${s.must}`;
  const priority = s.must === 'Must' ? 'High' : 'Medium';
  const labels = `poms,${s.role.toLowerCase().replace(/[^a-z]+/g, '-')},${s.id.toLowerCase()}`;
  rows.push([summary, 'Story', description, priority, labels, '', `SYS-01: Server-side Commercial Engine (RB-017, §13)`.includes(s.id) ? '' : '', String(s.points)]);
  rows.push([`Sub-task: Backend — ${s.id}`, 'Sub-task', `API + business rules for ${s.id} (${s.trace}), permission-gated and audit-logged.`, priority, 'poms,backend', '', '', '']);
  rows.push([`Sub-task: Frontend — ${s.id}`, 'Sub-task', `UI support for ${s.id} per §19 UX standards (no dead buttons, no fake metrics).`, priority, 'poms,frontend', '', '', '']);
  rows.push([`Sub-task: QA — ${s.id} acceptance`, 'Sub-task', `Given/When/Then: ${s.ac}`, priority, 'poms,qa', '', '', '']);
}

const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n');
const out = join(dirname(fileURLToPath(import.meta.url)), 'user-stories.csv');
writeFileSync(out, csv, 'utf8');
console.log(`Wrote ${rows.length - 1} issues → ${out}`);
