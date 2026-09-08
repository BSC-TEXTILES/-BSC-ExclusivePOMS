import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import POList from './pages/POList.jsx';
import POCreate from './pages/POCreate.jsx';
import PODetails from './pages/PODetails.jsx';
import Approvals from './pages/Approvals.jsx';
import Receipts from './pages/Receipts.jsx';
import Masters from './pages/Masters.jsx';
import Catalogue from './pages/Catalogue.jsx';
import Calendar from './pages/Calendar.jsx';
import Chat from './pages/Chat.jsx';
import Users from './pages/Users.jsx';
import Reports from './pages/Reports.jsx';
import AuditLogs from './pages/AuditLogs.jsx';
import Customers from './pages/Customers.jsx';
import OrderList from './pages/OrderList.jsx';
import OrderCreate from './pages/OrderCreate.jsx';
import OrderDetails from './pages/OrderDetails.jsx';
import Production from './pages/Production.jsx';
import CompanySettings from './pages/CompanySettings.jsx';
import CsvExports from './pages/CsvExports.jsx';

function RequireAuth({ children, permission }) {
  const { user, hasPermission } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !hasPermission(permission)) {
    return <div className="page"><div className="alert error">You do not have permission to view this screen ({permission}).</div></div>;
  }
  return children;
}

export default function App() {
  const { user } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('poms_sidebar') === '1');

  useEffect(() => {
    localStorage.setItem('poms_sidebar', collapsed ? '1' : '0');
  }, [collapsed]);

  // Public routes: landing page + login (login keeps its own full-screen layout).
  if (!user) {
    return (
      <Routes>
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/landing" replace />} />
      </Routes>
    );
  }
  if (location.pathname === '/login' || location.pathname === '/landing') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={`shell ${collapsed ? 'collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="main">
        <Topbar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        <main className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/purchase-orders" element={<RequireAuth><POList /></RequireAuth>} />
            <Route path="/purchase-orders/new" element={<RequireAuth permission="po.create"><POCreate /></RequireAuth>} />
            <Route path="/purchase-orders/:id" element={<RequireAuth><PODetails /></RequireAuth>} />
            <Route path="/calendar" element={<RequireAuth><Calendar /></RequireAuth>} />
            <Route path="/approvals" element={<RequireAuth permission="approvals.view"><Approvals /></RequireAuth>} />
            <Route path="/receipts" element={<RequireAuth permission="receipt.view"><Receipts /></RequireAuth>} />
            <Route path="/masters" element={<RequireAuth permission="masters.view"><Masters /></RequireAuth>} />
            <Route path="/catalogue" element={<RequireAuth><Catalogue /></RequireAuth>} />
            <Route path="/chat" element={<RequireAuth><Chat /></RequireAuth>} />
            <Route path="/users" element={<RequireAuth permission="users.manage"><Users /></RequireAuth>} />
            <Route path="/reports" element={<RequireAuth permission="reports.view"><Reports /></RequireAuth>} />
            <Route path="/audit-logs" element={<RequireAuth permission="audit.view"><AuditLogs /></RequireAuth>} />
            <Route path="/customers" element={<RequireAuth permission="order.create"><Customers /></RequireAuth>} />
            <Route path="/om-orders" element={<RequireAuth><OrderList /></RequireAuth>} />
            <Route path="/om-orders/new" element={<RequireAuth permission="order.create"><OrderCreate /></RequireAuth>} />
            <Route path="/om-orders/:id" element={<RequireAuth><OrderDetails /></RequireAuth>} />
            <Route path="/production" element={<RequireAuth permission="production.read"><Production /></RequireAuth>} />
            <Route path="/company-settings" element={<RequireAuth permission="settings.manage"><CompanySettings /></RequireAuth>} />
            <Route path="/csv-exports" element={<RequireAuth permission="csv.export"><CsvExports /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
