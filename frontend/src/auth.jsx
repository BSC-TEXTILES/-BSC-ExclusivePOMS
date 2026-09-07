import { createContext, useContext, useState } from 'react';
import api from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('poms_user') || 'null'); } catch { return null; }
  });

  async function login(identifier, password) {
    const { data } = await api.post('/auth/login', { identifier, password });
    localStorage.setItem('poms_token', data.accessToken);
    localStorage.setItem('poms_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  function logout() {
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

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, hasPermission, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
