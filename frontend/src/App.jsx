import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import CollectionView from './pages/CollectionView.jsx';
import Calendar from './pages/Calendar.jsx';
import Chat from './pages/Chat.jsx';
import Users from './pages/Users.jsx';
import Reports from './pages/Reports.jsx';
import AuditLogs from './pages/AuditLogs.jsx';
import Products from './pages/Products.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import ProductForm from './pages/ProductForm.jsx';
import ProductTypes from './pages/ProductTypes.jsx';
import Brands from './pages/Brands.jsx';
import Categories from './pages/Categories.jsx';
import Colors from './pages/Colors.jsx';
import Sizes from './pages/Sizes.jsx';
import Attributes from './pages/Attributes.jsx';
import ExportData from './pages/ExportData.jsx';
import Videos from './pages/Videos.jsx';
import VideoDetail from './pages/VideoDetail.jsx';
import Settings from './pages/Settings.jsx';
import Roles from './pages/Roles.jsx';
import Manufacturers from './pages/Manufacturers.jsx';
import Locations from './pages/Locations.jsx';
import Pricing from './pages/Pricing.jsx';
import NotFound from './pages/NotFound.jsx';
import Collections from './pages/Collections.jsx';
import Dealers from './pages/Dealers.jsx';
import CompanySettings from './pages/CompanySettings.jsx';
import Attachments from './pages/Attachments.jsx';
import Checkout from './pages/Checkout.jsx';
import ImportData from './pages/ImportData.jsx';
import ProfileModal from './components/ProfileModal.jsx';
import CookieConsent from './components/CookieConsent.jsx';
import { PrivacyPolicy, Terms, Security } from './pages/Legal.jsx';

function RequireAuth({ children, permission, superAdmin }) {
  const { user, hasPermission } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (superAdmin && !user.isSuperAdmin) {
    return <div className="page"><div className="alert error">Only the Administrator can manage roles and permissions.</div></div>;
  }
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

  // Public routes: landing page, login and the legal pages.
  // (Login keeps its own full-screen layout; legal pages get the cookie notice.)
  if (!user) {
    return (
      <>
        <Routes>
          <Route path="/landing" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/security" element={<Security />} />
          <Route path="*" element={<Navigate to="/landing" replace />} />
        </Routes>
        <CookieConsent />
      </>
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
          {/* Mandatory profile completion for admin-created accounts */}
          {user && !user.profileUpdatedAt && <ProfileModal />}
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<RequireAuth permission="dashboard.view"><Dashboard /></RequireAuth>} />
            <Route path="/purchase-orders" element={<RequireAuth permission="po.view"><POList /></RequireAuth>} />
            <Route path="/purchase-orders/new" element={<RequireAuth permission="po.create"><POCreate /></RequireAuth>} />
            <Route path="/purchase-orders/:id" element={<RequireAuth><PODetails /></RequireAuth>} />
            <Route path="/calendar" element={<RequireAuth permission="calendar.view"><Calendar /></RequireAuth>} />
            <Route path="/approvals" element={<RequireAuth permission="approvals.view"><Approvals /></RequireAuth>} />
            <Route path="/receipts" element={<RequireAuth permission="receipt.view"><Receipts /></RequireAuth>} />
            <Route path="/masters" element={<RequireAuth permission="masters.view"><Masters /></RequireAuth>} />
            <Route path="/catalogue" element={<RequireAuth permission="catalogue.view"><Catalogue /></RequireAuth>} />
            <Route path="/collection/:deptKey" element={<RequireAuth><CollectionView /></RequireAuth>} />
            <Route path="/chat" element={<RequireAuth permission="chat.view"><Chat /></RequireAuth>} />
            <Route path="/users" element={<RequireAuth permission="users.manage"><Users /></RequireAuth>} />
            <Route path="/reports" element={<RequireAuth permission="reports.view"><Reports /></RequireAuth>} />
            <Route path="/audit-logs" element={<RequireAuth permission="audit.view"><AuditLogs /></RequireAuth>} />
            <Route path="/collections" element={<RequireAuth permission="collections.view"><Collections /></RequireAuth>} />
            <Route path="/dealers" element={<RequireAuth permission="dealers.view"><Dealers /></RequireAuth>} />
            <Route path="/company" element={<RequireAuth permission="company.view"><CompanySettings /></RequireAuth>} />
            <Route path="/attachments" element={<RequireAuth permission="attachments.view"><Attachments /></RequireAuth>} />
            <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
            <Route path="/products" element={<RequireAuth permission="products.view"><Products /></RequireAuth>} />
            <Route path="/products/new" element={<RequireAuth permission="products.create"><ProductForm /></RequireAuth>} />
            <Route path="/products/:id" element={<RequireAuth permission="products.view"><ProductDetail /></RequireAuth>} />
            <Route path="/products/:id/edit" element={<RequireAuth permission="products.edit"><ProductForm /></RequireAuth>} />
            <Route path="/product-types" element={<RequireAuth permission="product_types.view"><ProductTypes /></RequireAuth>} />
            <Route path="/brands" element={<RequireAuth permission="brands.view"><Brands /></RequireAuth>} />
            <Route path="/categories" element={<RequireAuth permission="categories.view"><Categories /></RequireAuth>} />
            <Route path="/colors" element={<RequireAuth permission="colors.view"><Colors /></RequireAuth>} />
            <Route path="/sizes" element={<RequireAuth permission="sizes.view"><Sizes /></RequireAuth>} />
            <Route path="/attributes" element={<RequireAuth permission="masters.view"><Attributes /></RequireAuth>} />
            <Route path="/export-data" element={<RequireAuth permission="reports.export"><ExportData /></RequireAuth>} />
            <Route path="/import-data" element={<RequireAuth permission="import.manage"><ImportData /></RequireAuth>} />
            <Route path="/videos" element={<RequireAuth permission="videos.view"><Videos /></RequireAuth>} />
            <Route path="/videos/:id" element={<RequireAuth permission="videos.view"><VideoDetail /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth permission="settings.manage"><Settings /></RequireAuth>} />
            <Route path="/roles" element={<RequireAuth permission="users.manage" superAdmin><Roles /></RequireAuth>} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/security" element={<Security />} />
            <Route path="/manufacturers" element={<RequireAuth permission="manufacturers.view"><Manufacturers /></RequireAuth>} />
            <Route path="/locations" element={<RequireAuth permission="locations.view"><Locations /></RequireAuth>} />
            <Route path="/pricing" element={<RequireAuth permission="pricing.view"><Pricing /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
