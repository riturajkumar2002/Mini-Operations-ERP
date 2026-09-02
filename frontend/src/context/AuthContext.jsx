import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const PRESET_USERS = {
  admin: { email: 'admin@erp.com', password: 'admin123', role: 'ADMIN', label: 'Admin (Full Access)' },
  ops: { email: 'ops@erp.com', password: 'ops123', role: 'OPERATIONS', label: 'Operations User' },
  sales: { email: 'sales@erp.com', password: 'sales123', role: 'SALES', label: 'Sales User' },
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('erp_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('erp_token');
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          const userData = {
            id: res.data.id,
            email: res.data.email,
            full_name: res.data.full_name,
            role: res.data.role,
            assigned_location_id: res.data.assigned_location_id,
          };
          setUser(userData);
          localStorage.setItem('erp_user', JSON.stringify(userData));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { access_token, role, user_id, full_name } = res.data;
    const userData = { id: user_id, email, full_name, role };
    localStorage.setItem('erp_token', access_token);
    localStorage.setItem('erp_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const quickLogin = async (roleKey) => {
    const preset = PRESET_USERS[roleKey];
    if (preset) {
      return await login(preset.email, preset.password);
    }
  };

  const logout = () => {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    setUser(null);
  };

  const value = {
    user,
    role: user?.role,
    isAdmin: user?.role === 'ADMIN',
    isOperations: user?.role === 'OPERATIONS',
    isSales: user?.role === 'SALES',
    canManageInventory: user?.role === 'ADMIN' || user?.role === 'OPERATIONS',
    canCreateWorkOrder: user?.role === 'ADMIN',
    canManageTransfers: user?.role === 'ADMIN' || user?.role === 'OPERATIONS',
    canCreateOrder: user?.role === 'ADMIN' || user?.role === 'SALES',
    login,
    quickLogin,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
