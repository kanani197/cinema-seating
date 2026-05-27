import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CinemaProvider } from './context/CinemaContext';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import BookingPage from './pages/BookingPage';
import ConfirmationPage from './pages/ConfirmationPage';
import AdminPage from './pages/AdminPage';
import SimulationPage from './pages/SimulationPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import BookingHistoryPage from './pages/BookingHistoryPage';

/**
 * Require login (including guest). Redirect to /login if no user at all.
 * Guests ARE allowed through — they have a user object.
 */
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ background: '#0a0a0f', minHeight: '100vh' }} />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/**
 * Guest-only redirect: if a REAL (non-guest) user is logged in, go home.
 * Guests and logged-out users can access login/register.
 */
function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  // Only redirect if a real registered user is logged in
  if (user && !user.isGuest) return <Navigate to="/" replace />;
  return children;
}

/** Admin-only */
function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <div className="min-h-screen" style={{ background: '#0a0a0f' }}>
      <Routes>
        {/* Auth pages — no Navbar (guests can still access to sign in/register) */}
        <Route path="/login"    element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />

        {/* Main app with Navbar */}
        <Route path="/*" element={
          <>
            <Navbar />
            <Routes>
              <Route path="/"             element={<HomePage />} />
              <Route path="/simulate"     element={<SimulationPage />} />
              {/* Guests allowed on book/confirmation/my-bookings */}
              <Route path="/book"         element={<RequireAuth><BookingPage /></RequireAuth>} />
              <Route path="/confirmation" element={<RequireAuth><ConfirmationPage /></RequireAuth>} />
              <Route path="/my-bookings"  element={<RequireAuth><BookingHistoryPage /></RequireAuth>} />
              <Route path="/admin"        element={<RequireAdmin><AdminPage /></RequireAdmin>} />
              <Route path="*"             element={<Navigate to="/" replace />} />
            </Routes>
          </>
        } />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CinemaProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </CinemaProvider>
    </AuthProvider>
  );
}
