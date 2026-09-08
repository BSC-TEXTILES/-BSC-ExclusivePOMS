const LABELS = {
  draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review', approved: 'Approved',
  issued: 'Issued', partially_received: 'Partially Received', received: 'Received', closed: 'Closed',
  cancelled: 'Cancelled', active: 'Active', inactive: 'Inactive', archived: 'Archived',
  posted: 'Posted', pending_approval: 'Pending Approval', rejected: 'Rejected',
  assigned: 'Assigned', production_started: 'Production Started', in_production: 'In Production',
  quality_check: 'Quality Check', production_completed: 'Production Completed',
  ready_for_delivery: 'Ready for Delivery', delivered: 'Delivered', completed: 'Completed',
  pending: 'Pending', started: 'Started', in_progress: 'In Progress',
  paused: 'Paused', delayed: 'Delayed',
  online: 'Online', offline: 'Offline', working: 'Working', idle: 'Idle',
  on_leave: 'On Leave', suspended: 'Suspended',
};

export default function StatusChip({ status }) {
  return <span className={`chip st-${status}`}>{LABELS[status] || status}</span>;
}
