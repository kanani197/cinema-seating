import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { user, logout, isAdmin, isGuest } = useAuth();
  const [open, setOpen] = useState(false);

  const navLinks = [
    { to: '/',            label: 'Home' },
    { to: '/book',        label: 'Book Seats',  requireAuth: true },
    { to: '/simulate',    label: 'Simulation' },
    { to: '/my-bookings', label: 'My Bookings', requireAuth: true },
    { to: '/admin',       label: '👑 Admin',    adminOnly: true },
  ].filter(l => {
    if (l.adminOnly) return isAdmin;
    if (l.requireAuth) return !!user;
    return true;
  });

  const active = (p) => location.pathname === p;

  const handleLogout = () => {
    logout();
    navigate('/login');
    setOpen(false);
  };

  // Role badge
  const roleBadge = isAdmin
    ? { label: 'Admin', bg: 'rgba(232,184,75,0.15)', color: '#e8b84b', border: 'rgba(232,184,75,0.3)' }
    : isGuest
    ? { label: 'Guest', bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)' }
    : { label: 'Customer', bg: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: 'rgba(59,130,246,0.3)' };

  return (
    <nav style={{ background: '#12121a', borderBottom: '1px solid #2a2a3e' }}
         className="sticky top-0 z-50 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, #e8b84b, #c89530)' }}>
            <span className="text-black font-bold text-sm">C</span>
          </div>
          <span style={{ fontFamily: '"DM Serif Display", serif', color: '#e8b84b', fontSize: '1.05rem' }}>
            CinemaSeat
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(l => (
            <Link key={l.to} to={l.to}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                color:      active(l.to) ? '#e8b84b' : '#94a3b8',
                background: active(l.to) ? 'rgba(232,184,75,0.1)' : 'transparent',
              }}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Auth zone */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              {/* User pill */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                   style={{ background: '#1a1a26', border: '1px solid #2a2a3e' }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                     style={{ background: roleBadge.bg, color: roleBadge.color }}>
                  {user.name?.[0]?.toUpperCase() || 'G'}
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-medium" style={{ color: '#f1f5f9' }}>
                    {isGuest ? 'Guest' : user.name}
                  </span>
                  <span className="text-xs px-1.5 rounded" style={{
                    background: roleBadge.bg, color: roleBadge.color,
                    border: `1px solid ${roleBadge.border}`, fontSize: '0.6rem'
                  }}>
                    {roleBadge.label}
                  </span>
                </div>
              </div>

              {/* Sign in / register for guests */}
              {isGuest ? (
                <div className="flex gap-1.5">
                  <Link to="/login"
                    onClick={() => logout()}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: '#1a1a26', border: '1px solid #2a2a3e', color: '#94a3b8' }}>
                    Sign In
                  </Link>
                  <Link to="/register"
                    onClick={() => logout()}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'linear-gradient(135deg, #e8b84b, #c89530)', color: '#0a0a0f' }}>
                    Register
                  </Link>
                </div>
              ) : (
                <button onClick={handleLogout}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: '#1a1a26', border: '1px solid #2a2a3e', color: '#64748b' }}>
                  Logout
                </button>
              )}
            </>
          ) : (
            <div className="flex gap-1.5">
              <Link to="/login"
                className="px-4 py-1.5 rounded-lg text-sm"
                style={{ color: '#94a3b8', border: '1px solid #2a2a3e' }}>
                Login
              </Link>
              <Link to="/register"
                className="px-4 py-1.5 rounded-lg text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg, #e8b84b, #c89530)', color: '#0a0a0f' }}>
                Register
              </Link>
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setOpen(o => !o)} className="md:hidden p-2"
                style={{ color: '#94a3b8', fontSize: '1.2rem' }}>
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden mt-2 pb-3" style={{ borderTop: '1px solid #2a2a3e' }}>
          {navLinks.map(l => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm"
              style={{ color: active(l.to) ? '#e8b84b' : '#94a3b8' }}>
              {l.label}
            </Link>
          ))}
          <div className="px-4 pt-3 flex gap-2 border-t mt-2" style={{ borderColor: '#2a2a3e' }}>
            {user ? (
              isGuest ? (
                <>
                  <Link to="/login" onClick={() => { logout(); setOpen(false); }}
                    className="text-sm px-3 py-1.5 rounded-lg"
                    style={{ background: '#1a1a26', border: '1px solid #2a2a3e', color: '#94a3b8' }}>
                    Sign In
                  </Link>
                  <Link to="/register" onClick={() => { logout(); setOpen(false); }}
                    className="text-sm px-3 py-1.5 rounded-lg font-semibold"
                    style={{ background: 'linear-gradient(135deg,#e8b84b,#c89530)', color: '#0a0a0f' }}>
                    Register
                  </Link>
                </>
              ) : (
                <button onClick={handleLogout}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ color: '#64748b', border: '1px solid #2a2a3e' }}>
                  Logout ({user.name})
                </button>
              )
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)} className="text-sm" style={{ color: '#94a3b8' }}>Login</Link>
                <Link to="/register" onClick={() => setOpen(false)} className="text-sm" style={{ color: '#e8b84b' }}>Register</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
