import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const QUICK_LOGINS = [
  { label: 'Admin Demo',    email: 'admin@cinema.com',    password: 'admin123',    role: 'admin',    color: '#e8b84b', icon: '👑' },
  { label: 'Customer Demo', email: 'customer@cinema.com', password: 'customer123', role: 'customer', color: '#3b82f6', icon: '🎬' },
];

export default function LoginPage() {
  const { login, continueAsGuest, logout } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const doLogin = async (email, password) => {
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) navigate('/');
    else setError(result.error);
  };

  const handleSubmit = e => { e.preventDefault(); doLogin(form.email, form.password); };

  const handleGuest = () => {
    // Clear any existing session first so guest gets a clean state
    logout();
    continueAsGuest();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0a0f' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg,#e8b84b,#c89530)' }}>
              <span className="text-black font-bold">C</span>
            </div>
            <span style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.4rem', color: '#e8b84b' }}>
              CinemaSeat
            </span>
          </div>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.8rem', color: '#f1f5f9' }}>
            Welcome back
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#64748b' }}>Sign in to manage your bookings</p>
        </div>

        {/* Quick demo buttons */}
        <div className="rounded-xl p-4 mb-4" style={{ background: '#12121a', border: '1px solid #2a2a3e' }}>
          <p className="text-xs mb-3 text-center" style={{ color: '#64748b' }}>
            ⚡ Demo accounts — work offline without a backend
          </p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_LOGINS.map(q => (
              <button key={q.email} onClick={() => doLogin(q.email, q.password)} disabled={loading}
                className="py-3 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
                style={{
                  background: `rgba(${q.color === '#e8b84b' ? '232,184,75' : '59,130,246'},0.12)`,
                  border:    `1px solid ${q.color}44`,
                  color: q.color,
                }}>
                <div className="text-xl mb-1">{q.icon}</div>
                <div>{q.label}</div>
                <div className="text-xs opacity-60 font-normal mt-0.5">{q.role}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl p-6" style={{ background: '#1a1a26', border: '1px solid #2a2a3e' }}>
          <p className="text-xs text-center mb-4" style={{ color: '#475569' }}>or sign in with your account</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#94a3b8' }}>Email</label>
              <input name="email" type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com" autoComplete="email"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: '#12121a', border: '1px solid #2a2a3e', color: '#f1f5f9' }} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#94a3b8' }}>Password</label>
              <input name="password" type="password" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••" autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: '#12121a', border: '1px solid #2a2a3e', color: '#f1f5f9' }} />
            </div>

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm"
                   style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg,#e8b84b,#c89530)', color: '#0a0a0f' }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: '#2a2a3e' }} />
            <span className="text-xs" style={{ color: '#475569' }}>or</span>
            <div className="flex-1 h-px" style={{ background: '#2a2a3e' }} />
          </div>

          <button onClick={handleGuest}
            className="mt-4 w-full py-3 rounded-xl font-medium text-sm"
            style={{ background: '#12121a', border: '1px solid #2a2a3e', color: '#94a3b8' }}>
            Continue as Guest
          </button>

          <p className="mt-5 text-center text-sm" style={{ color: '#64748b' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#e8b84b' }} className="hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
