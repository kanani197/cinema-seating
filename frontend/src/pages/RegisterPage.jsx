import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, isAdminEmail } from '../context/AuthContext';

export default function RegisterPage() {
  const { register, continueAsGuest } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]   = useState({ name: '', email: '', password: '', confirm: '', role: 'customer' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  // Live validation: show @cinema.com hint when admin is selected
  const adminEmailOk = form.role !== 'admin' || isAdminEmail(form.email);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.password) return setError('All fields are required.');
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    if (form.role === 'admin' && !isAdminEmail(form.email)) {
      return setError('Admin accounts require a @cinema.com email address.');
    }
    setLoading(true);
    const result = await register(form.name.trim(), form.email.trim(), form.password, form.role);
    setLoading(false);
    if (result.success) navigate('/');
    else setError(result.error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0a0f' }}>
      <div className="w-full max-w-md">
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
            Create an account
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#64748b' }}>Works offline — data stored locally if no server</p>
        </div>

        <div className="rounded-2xl p-6" style={{ background: '#1a1a26', border: '1px solid #2a2a3e' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#94a3b8' }}>Full Name</label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="John Smith"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: '#12121a', border: '1px solid #2a2a3e', color: '#f1f5f9' }} />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#94a3b8' }}>Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange}
                placeholder={form.role === 'admin' ? 'yourname@cinema.com' : 'you@example.com'}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{
                  background: '#12121a', color: '#f1f5f9',
                  border: `1px solid ${form.role === 'admin' && form.email && !adminEmailOk ? '#ef4444' : '#2a2a3e'}`,
                }} />
              {form.role === 'admin' && form.email && !adminEmailOk && (
                <p className="text-xs mt-1" style={{ color: '#ef4444' }}>
                  Admin email must end with @cinema.com
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#94a3b8' }}>Password</label>
              <input name="password" type="password" value={form.password} onChange={handleChange}
                placeholder="Min 6 characters" autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: '#12121a', border: '1px solid #2a2a3e', color: '#f1f5f9' }} />
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#94a3b8' }}>Confirm Password</label>
              <input name="confirm" type="password" value={form.confirm} onChange={handleChange}
                placeholder="••••••••" autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: '#12121a', border: '1px solid #2a2a3e', color: '#f1f5f9' }} />
            </div>

            {/* Role selector */}
            <div>
              <label className="block text-xs mb-2" style={{ color: '#94a3b8' }}>Account Role</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'customer', icon: '🎬', label: 'Customer', desc: 'Book & manage seats',  color: '#3b82f6' },
                  { value: 'admin',    icon: '👑', label: 'Admin',    desc: '@cinema.com required', color: '#e8b84b' },
                ].map(r => (
                  <button key={r.value} type="button"
                    onClick={() => setForm(f => ({ ...f, role: r.value }))}
                    className="p-3 rounded-xl text-left transition-all"
                    style={{
                      background: form.role === r.value
                        ? `rgba(${r.color === '#e8b84b' ? '232,184,75' : '59,130,246'},0.1)` : '#12121a',
                      border: `1px solid ${form.role === r.value ? r.color : '#2a2a3e'}`,
                    }}>
                    <div className="text-lg mb-1">{r.icon}</div>
                    <div className="text-xs font-semibold"
                         style={{ color: form.role === r.value ? r.color : '#94a3b8' }}>
                      {r.label}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#475569' }}>{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm"
                   style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || (form.role === 'admin' && form.email && !adminEmailOk)}
              className="w-full py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg,#e8b84b,#c89530)', color: '#0a0a0f' }}>
              {loading ? 'Creating…' : `Create ${form.role === 'admin' ? 'Admin' : 'Customer'} Account`}
            </button>
          </form>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: '#2a2a3e' }} />
            <span className="text-xs" style={{ color: '#475569' }}>or</span>
            <div className="flex-1 h-px" style={{ background: '#2a2a3e' }} />
          </div>
          <button onClick={() => { continueAsGuest(); navigate('/'); }}
            className="mt-4 w-full py-3 rounded-xl text-sm font-medium"
            style={{ background: '#12121a', border: '1px solid #2a2a3e', color: '#94a3b8' }}>
            Continue as Guest
          </button>
          <p className="mt-5 text-center text-sm" style={{ color: '#64748b' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#e8b84b' }} className="hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
