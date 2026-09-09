// Single source of truth for demo mode: the login page shows seeded demo
// accounts ONLY when this is true. Non-production defaults to true; set
// DEMO_MODE=false (or NODE_ENV=production) on real systems.
export function isDemoMode() {
  if (process.env.DEMO_MODE) return process.env.DEMO_MODE !== 'false';
  return process.env.NODE_ENV !== 'production';
}
