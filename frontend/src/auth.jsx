import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth as useClerkAuth, useUser as useClerkUser, useClerk } from '@clerk/clerk-react';
import api, { setTokenGetter } from './api.js';

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

// ─── Clerk-backed auth context ─────────────────────────────────────────────
// Provides the same shape the rest of the app expects (user, hasPermission,
// etc.) by reading from Clerk sessions and fetching RBAC data from /api/auth/me.

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { isSignedIn, getToken } = useClerkAuth();
  const { user: clerkUser, isLoaded: clerkLoaded } = useClerkUser();
  const clerk = useClerk();
  const [rbacUser, setRbacUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSectionId, setSelectedSectionId] = useState(() => {
    try { return localStorage.getItem('poms_selected_section') || null; } catch { return null; }
  });
  const fetchedRef = useRef(false);

  // Expose Clerk's getToken to the Axios interceptor
  useEffect(() => {
    setTokenGetter(isSignedIn ? getToken : null);
    return () => setTokenGetter(null);
  }, [isSignedIn, getToken]);

  // Fetch RBAC data from the backend whenever the user signs in
  const fetchRbac = useCallback(async () => {
    if (!isSignedIn) {
      setRbacUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setRbacUser(data.user);
    } catch {
      setRbacUser(null);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    fetchRbac();
  }, [fetchRbac]);

  function selectSection(sectionId) {
    localStorage.setItem('poms_selected_section', sectionId);
    setSelectedSectionId(sectionId);
  }

  function clearSection() {
    localStorage.removeItem('poms_selected_section');
    setSelectedSectionId(null);
  }

  // Sync local RBAC fields back after a profile update
  function updateUser(fields) {
    setRbacUser((prev) => prev ? { ...prev, ...fields } : prev);
  }

  // Sign out from Clerk + clear local state
  async function logout() {
    try { await clerk.signOut(); } catch { /* ignore */ }
    setRbacUser(null);
    setLoading(false);
    fetchedRef.current = false;
    window.location.href = '/login';
  }

  // Build the user object combining Clerk info with RBAC data
  const user = clerkUser && rbacUser ? {
    ...rbacUser,
    clerkId: clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress || rbacUser.email,
    fullName: clerkUser.fullName || rbacUser.fullName,
    profilePhotoUrl: clerkUser.imageUrl || rbacUser.profilePhotoUrl,
  } : null;

  const hasPermission = useCallback((code) => !!user && (user.isSuperAdmin || user.permissions?.includes(code)), [user]);
  const hasRole = useCallback((code) => !!user && user.roles?.includes(code), [user]);
  const isSectionSelected = useCallback((sectionId) => !selectedSectionId || selectedSectionId === sectionId || user?.isSuperAdmin, [selectedSectionId, user]);
  const canAccessSection = useCallback((sectionId) => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    if (!selectedSectionId) return user.sectionIds?.includes(String(sectionId));
    return selectedSectionId === String(sectionId);
  }, [user, selectedSectionId]);

  return (
    <AuthContext.Provider value={{
      user,
      loading: loading || !clerkLoaded,
      hasPermission,
      hasRole,
      selectedSectionId,
      selectSection,
      clearSection,
      isSectionSelected,
      canAccessSection,
      updateUser,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Safe default so useAuth() never returns null (prevents destructuring crashes)
const _noop = () => {};
const _defaultAuth = {
  user: null, loading: true,
  hasPermission: () => false, hasRole: () => false,
  selectedSectionId: null, selectSection: _noop, clearSection: _noop,
  isSectionSelected: () => false, canAccessSection: () => false,
  updateUser: _noop, logout: _noop,
};

export const useAuth = () => useContext(AuthContext) || _defaultAuth;
