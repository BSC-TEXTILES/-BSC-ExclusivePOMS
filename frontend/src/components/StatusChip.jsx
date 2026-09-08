const LABELS = {
  draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review', approved: 'Approved',
  issued: 'Issued', partially_received: 'Partially Received', received: 'Received', closed: 'Closed',
  cancelled: 'Cancelled', active: 'Active', inactive: 'Inactive', archived: 'Archived',
  posted: 'Posted',
};

export default function StatusChip({ status }) {
  return <span className={`chip st-${status}`}>{LABELS[status] || status}</span>;
}
