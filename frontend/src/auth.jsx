import { createContext, useContext, useState, useEffect } from 'react';

// Cart context — pending purchase orders placed by ANY role (admin, supervisor,
// purchase executive). Shown in the top-navigation cart icon; reviewed and
// crosschecked at checkout before the order is finally placed, after which a
// complete summary invoice is generated. Persisted per browser.
const CartContext = createContext(null);

const KEY = 'poms_cart';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  }, [items]);

  function addItem(po) {
    if (!po?.id) return;
    setItems((list) => (list.some((i) => i.id === po.id)
      ? list
      : [...list, {
        id: po.id,
        poNumber: po.po_number,
        sectionName: po.section_name || '',
        supplierName: po.supplier_name || '',
        itemCount: po.item_count || null,
        grandTotal: po.grand_total ?? null,
        status: po.status || 'draft',
        addedAt: new Date().toISOString(),
      }]));
  }

  function removeItem(id) {
    setItems((list) => list.filter((i) => i.id !== id));
  }

  function clear() {
    setItems([]);
  }

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clear, count: items.length }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
import api from './api.js';
import { getTabId } from './utils/devtools.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('poms_user') || 'null'); } catch { return null; }
  });
  const [selectedSectionId, setSelectedSectionId] = useState(() => {
    try { return localStorage.getItem('poms_selected_section') || null; } catch { return null; }
  });

  async function login(identifier, password, extra = {}) {
    const { data } = await api.post('/auth/login', { identifier, password, ...extra });
    localStorage.setItem('poms_token', data.accessToken);
    localStorage.setItem('poms_user', JSON.stringify(data.user));
    setUser(data.user);
    try { sessionStorage.removeItem('poms_geo_asked'); } catch { /* ignore */ }
    return data.user;
  }

  function selectSection(sectionId) {
    localStorage.setItem('poms_selected_section', sectionId);
    setSelectedSectionId(sectionId);
  }

  function clearSection() {
    localStorage.removeItem('poms_selected_section');
    setSelectedSectionId(null);
  }

  function logout() {
    // Report the session end first — keepalive fetch survives the teardown.
    try {
      const token = localStorage.getItem('poms_token');
      if (token) {
        fetch('/api/tracking/logout', {
          method: 'POST', keepalive: true,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tabId: getTabId() }),
        }).catch(() => {});
      }
    } catch { /* best effort */ }
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('poms_token');
    localStorage.removeItem('poms_user');
    setUser(null);
  }

  // Sync profile/role changes (photo upload, admin edits) into context + storage.
  function updateUser(patch) {
    setUser((u) => {
      if (!u) return u;
      const next = { ...u, ...patch };
      localStorage.setItem('poms_user', JSON.stringify(next));
      return next;
    });
  }

  const hasPermission = (code) => !!user && (user.isSuperAdmin || user.permissions?.includes(code));
  const hasRole = (code) => !!user && user.roles?.includes(code);
  const isSectionSelected = (sectionId) => !selectedSectionId || selectedSectionId === sectionId || user.isSuperAdmin;
  const canAccessSection = (sectionId) => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    if (!selectedSectionId) return user.sectionIds?.includes(String(sectionId));
    return selectedSectionId === String(sectionId);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      updateUser, 
      hasPermission, 
      hasRole,
      selectedSectionId,
      selectSection,
      clearSection,
      isSectionSelected,
      canAccessSection
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
