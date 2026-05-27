import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const setAxiosToken = (token) => {
  if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  else delete axios.defaults.headers.common['Authorization'];
};

// ── Offline demo accounts (work without backend) ──────────────────────────────
const DEMO_USERS = {
  'admin@cinema.com':    { password: 'admin123',    role: 'admin',    name: 'Demo Admin' },
  'customer@cinema.com': { password: 'customer123', role: 'customer', name: 'Demo Customer' },
};

// ── Admin rule: email must end with @cinema.com ───────────────────────────────
export function isAdminEmail(email) {
  return email?.toLowerCase().trim().endsWith('@cinema.com');
}

function createLocalUser(id, name, email, role) {
  return { id, name, email, role, isLocal: true, isGuest: false };
}

// Generate a persistent guest ID stored in localStorage
function getOrCreateGuestId() {
  let gid = localStorage.getItem('cinema_guest_id');
  if (!gid) {
    gid = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    localStorage.setItem('cinema_guest_id', gid);
  }
  return gid;
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('cinema_token');
    const storedUser  = localStorage.getItem('cinema_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        if (storedToken) { setToken(storedToken); setAxiosToken(storedToken); }
      } catch { localStorage.removeItem('cinema_user'); }
    }
    setLoading(false);
  }, []);

  const _persist = (userData, jwtToken = null) => {
    localStorage.setItem('cinema_user', JSON.stringify(userData));
    if (jwtToken) {
      localStorage.setItem('cinema_token', jwtToken);
      setAxiosToken(jwtToken);
      setToken(jwtToken);
    } else {
      // Remove old token if logging in locally
      localStorage.removeItem('cinema_token');
      setAxiosToken(null);
      setToken(null);
    }
    setUser(userData);
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const normalEmail = email.toLowerCase().trim();
    try {
      const { data } = await axios.post('/api/auth/login', { email: normalEmail, password }, { timeout: 4000 });
      _persist(data.user, data.token);
      return { success: true };
    } catch (apiErr) {
      // Offline fallback: check demo accounts
      const demo = DEMO_USERS[normalEmail];
      if (demo && demo.password === password) {
        _persist(createLocalUser(`local_${Date.now()}`, demo.name, normalEmail, demo.role));
        return { success: true };
      }
      // Check locally-registered users
      const localUsers = JSON.parse(localStorage.getItem('local_users') || '[]');
      const found = localUsers.find(u => u.email === normalEmail && u.password === password);
      if (found) {
        _persist(createLocalUser(found.id, found.name, found.email, found.role));
        return { success: true };
      }
      return { success: false, error: apiErr.response?.data?.error || 'Incorrect email or password.' };
    }
  }, []);

  // ── Register ──────────────────────────────────────────────────────────────
  const register = useCallback(async (name, email, password, role = 'customer') => {
    const normalEmail = email.toLowerCase().trim();

    // Enforce @cinema.com for admin
    if (role === 'admin' && !isAdminEmail(normalEmail)) {
      return { success: false, error: 'Admin accounts require a @cinema.com email address.' };
    }

    try {
      const { data } = await axios.post('/api/auth/register',
        { name, email: normalEmail, password, role }, { timeout: 4000 });
      _persist(data.user, data.token);
      return { success: true };
    } catch (apiErr) {
      if (apiErr.response) {
        return { success: false, error: apiErr.response.data?.error || 'Registration failed.' };
      }
      // Offline: store locally
      const localUsers = JSON.parse(localStorage.getItem('local_users') || '[]');
      if (localUsers.find(u => u.email === normalEmail)) {
        return { success: false, error: 'An account with that email already exists.' };
      }
      const newUser = { id: `local_${Date.now()}`, name, email: normalEmail, password, role };
      localUsers.push(newUser);
      localStorage.setItem('local_users', JSON.stringify(localUsers));
      _persist(createLocalUser(newUser.id, name, normalEmail, role));
      return { success: true };
    }
  }, []);

  // ── Logout — clears everything including guest ────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('cinema_token');
    localStorage.removeItem('cinema_user');
    // NOTE: keep cinema_guest_id so their bookings remain accessible
    setAxiosToken(null);
    setToken(null);
    setUser(null);
  }, []);

  // ── Continue as Guest ─────────────────────────────────────────────────────
  const continueAsGuest = useCallback(() => {
    const guestId = getOrCreateGuestId();
    const guest = {
      id: guestId,
      name: 'Guest',
      email: `${guestId}@guest.local`,
      role: 'customer',
      isGuest: true,
      isLocal: true,
      guestId,
    };
    _persist(guest); // saved to localStorage so guest persists across refresh
  }, []);

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, register, logout, continueAsGuest,
      isAdmin: user?.role === 'admin',
      isGuest: !!user?.isGuest,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
