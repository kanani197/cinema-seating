import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useCinema, getLocalBookings, cancelBookingLocally } from '../context/CinemaContext';
import { useAuth } from '../context/AuthContext';
import SeatGrid from '../components/seats/SeatGrid';
import StatsBar from '../components/StatsBar';
import { buildInMemoryLayout } from '../utils/layoutBuilder';
import { calculateFragmentationClient } from '../utils/algorithmClient';

const ADMIN_HEADER = { 'x-admin-secret': 'cinema_admin_2024' };

// Small reusable button with loading state
function Btn({ onClick, loading, disabled, children, variant = 'default', className = '' }) {
  const styles = {
    default: { background: '#1a1a26', border: '1px solid #2a2a3e', color: '#94a3b8' },
    danger:  { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' },
    warning: { background: 'rgba(232,184,75,0.1)', border: '1px solid rgba(232,184,75,0.3)', color: '#e8b84b' },
    purple:  { background: '#7c3aed', color: 'white', border: 'none' },
    success: { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' },
  };
  return (
    <button onClick={onClick} disabled={loading || disabled}
      className={`py-2 px-4 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${className}`}
      style={{ ...styles[variant], opacity: loading || disabled ? 0.5 : 1, cursor: loading || disabled ? 'not-allowed' : 'pointer' }}>
      {loading && <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}

export default function AdminPage() {
  const { seats, stats, dispatch, resetLayout, loadSeats } = useCinema();
  const { user } = useAuth();

  const [tab,          setTab]         = useState('overview');
  const [overrideForm, setOverrideForm]= useState({ row: 'G', number: 10, action: 'break' });
  const [msg,          setMsg]         = useState({ text: '', type: 'success' });
  const [allBookings,  setAllBookings] = useState([]);
  const [users,        setUsers]       = useState([]);
  const [serverStats,  setServerStats] = useState(null);
  const [dataLoading,  setDataLoading] = useState(false);
  const [btnLoading,   setBtnLoading]  = useState('');

  const notify = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: 'success' }), 4000);
  };

  // ── Load all admin data ────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setDataLoading(true);

    if (seats.length === 0) {
      const s = buildInMemoryLayout('default');
      dispatch({ type: 'SET_SEATS', payload: s });
      dispatch({ type: 'SET_STATS', payload: calculateFragmentationClient(s) });
    }

    const localBookings = getLocalBookings();

    const authHeader = user?.token
      ? { Authorization: `Bearer ${user.token}` }
      : ADMIN_HEADER;

    try {
      const [statsRes, bookingsRes, usersRes] = await Promise.allSettled([
        axios.get('/api/admin/stats',  { headers: ADMIN_HEADER, timeout: 4000 }),
        axios.get('/api/bookings/all', { headers: authHeader, timeout: 4000 }),
        axios.get('/api/auth/users',   { headers: authHeader, timeout: 4000 }),
      ]);

      if (statsRes.status === 'fulfilled')    setServerStats(statsRes.value.data);
      if (usersRes.status === 'fulfilled')    setUsers(usersRes.value.data.users || []);

      if (bookingsRes.status === 'fulfilled') {
        const apiBookings = bookingsRes.value.data.bookings || [];
        const apiRefs = new Set(apiBookings.map(b => b.bookingRef));
        const merged  = [
          ...apiBookings,
          ...localBookings.filter(b => !apiRefs.has(b.bookingRef))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setAllBookings(merged);
      } else {
        setAllBookings(localBookings);
      }
    } catch {
      setAllBookings(localBookings);
    }

    // Also refresh seat state from backend
    try {
      const { data } = await axios.get('/api/seats?sessionId=default', { timeout: 3000 });
      dispatch({ type: 'SET_SEATS', payload: data.seats });
      dispatch({ type: 'SET_STATS', payload: data.stats });
    } catch { /* use local state */ }

    setDataLoading(false);
  }, [seats.length, dispatch, user]);

  useEffect(() => { loadAll(); }, []);

  // ── Seat override ──────────────────────────────────────────────────────────
  const applyOverride = async () => {
    setBtnLoading('override');
    const row = overrideForm.row.toUpperCase();
    const num = parseInt(overrideForm.number);

    try {
      if (overrideForm.action === 'break') {
        await axios.post('/api/admin/mark-broken',   { row, number: num }, { headers: ADMIN_HEADER, timeout: 3000 });
      } else if (overrideForm.action === 'restore') {
        await axios.post('/api/admin/restore-seat',  { row, number: num }, { headers: ADMIN_HEADER, timeout: 3000 });
      }
    } catch { /* apply client-side */ }

    const updated = seats.map(s => {
      if (s.row !== row || s.number !== num) return s;
      if (overrideForm.action === 'break')   return { ...s, status:'broken',    type:'broken' };
      if (overrideForm.action === 'restore') return { ...s, status:'available', type:'regular' };
      if (overrideForm.action === 'book')    return { ...s, status:'booked' };
      return s;
    });
    dispatch({ type: 'SET_SEATS', payload: updated });
    dispatch({ type: 'SET_STATS', payload: calculateFragmentationClient(updated) });
    try { localStorage.setItem('cinema_seats_default', JSON.stringify(updated)); } catch {}
    notify(`Seat ${row}${num}: "${overrideForm.action}" applied`);
    setBtnLoading('');
  };

  // ── Generate broken seats ──────────────────────────────────────────────────
  const handleGenerateBroken = async () => {
    setBtnLoading('broken');
    try {
      // First ensure seats exist in DB (init if empty)
      await axios.get('/api/seats?sessionId=default', { headers: ADMIN_HEADER, timeout: 4000 });
      // Then generate broken seats
      const { data } = await axios.post('/api/admin/generate-broken', { sessionId: 'default' },
        { headers: ADMIN_HEADER, timeout: 5000 });
      const count = data.brokenCount || 0;
      notify(count > 0 ? `${count} broken seats generated` : 'Broken seats regenerated (layout was fresh)');
      await loadSeats('default');
    } catch {
      // Full client-side fallback: generate 6-10 broken seats on the current layout
      let workingSeats = seats.length > 0 ? [...seats] : JSON.parse(localStorage.getItem('cinema_seats_default') || '[]');
      if (workingSeats.length === 0) {
        const { buildInMemoryLayout: bil } = await import('../utils/layoutBuilder');
        workingSeats = bil('default');
      }
      // First restore any existing broken seats to regular
      let restored = workingSeats.map(s =>
        s.type === 'broken' ? { ...s, type: 'regular', status: 'available' } : s
      );
      // Generate 6-10 broken seats: not in rows A/B, not disability, not adjacent, max 2/row
      const eligible = restored.filter(s =>
        !['A','B'].includes(s.row) && s.type !== 'disability' && s.type !== 'vip' && s.status === 'available'
      ).sort(() => Math.random() - 0.5);
      const targetCount = Math.floor(Math.random() * 5) + 6; // 6-10
      const brokenSet = new Set();
      const rowCount = {};
      const toBreak = [];
      for (const seat of eligible) {
        if (toBreak.length >= targetCount) break;
        if ((rowCount[seat.row] || 0) >= 2) continue;
        const leftKey  = `${seat.row}-${seat.number - 1}`;
        const rightKey = `${seat.row}-${seat.number + 1}`;
        if (brokenSet.has(leftKey) || brokenSet.has(rightKey)) continue;
        brokenSet.add(`${seat.row}-${seat.number}`);
        rowCount[seat.row] = (rowCount[seat.row] || 0) + 1;
        toBreak.push(`${seat.row}_${seat.number}`);
      }
      const updated = restored.map(s =>
        toBreak.includes(`${s.row}_${s.number}`)
          ? { ...s, type: 'broken', status: 'broken' } : s
      );
      localStorage.setItem('cinema_seats_default', JSON.stringify(updated));
      dispatch({ type: 'SET_SEATS', payload: updated });
      dispatch({ type: 'SET_STATS', payload: calculateFragmentationClient(updated) });
      notify(`${toBreak.length} broken seats generated (offline mode)`);
    }
    setBtnLoading('');
  };

  // ── Cancel any booking (admin) ─────────────────────────────────────────────
  const handleCancelBooking = async (bookingRef) => {
    setBtnLoading(`cancel_${bookingRef}`);
    try {
      await axios.post('/api/admin/cancel-booking', { bookingRef },
        { headers: ADMIN_HEADER, timeout: 4000 });
    } catch { /* apply locally */ }

    cancelBookingLocally(bookingRef);
    const booking = allBookings.find(b => b.bookingRef === bookingRef);
    if (booking?.seats) {
      const updated = seats.map(s => {
        const freed = booking.seats.some(bs => bs.row === s.row && bs.number === s.number);
        return freed ? { ...s, status:'available', bookingId: null } : s;
      });
      dispatch({ type: 'SET_SEATS', payload: updated });
      dispatch({ type: 'SET_STATS', payload: calculateFragmentationClient(updated) });
      try { localStorage.setItem('cinema_seats_default', JSON.stringify(updated)); } catch {}
    }
    setAllBookings(prev => prev.map(b =>
      b.bookingRef === bookingRef ? { ...b, status:'cancelled' } : b
    ));
    notify(`Booking ${bookingRef} cancelled`);
    setBtnLoading('');
  };

  // ── Full reset ─────────────────────────────────────────────────────────────
  const handleReset = async () => {
    setBtnLoading('reset');
    try {
      await axios.post('/api/admin/reset', {}, { headers: ADMIN_HEADER, timeout: 5000 });
    } catch { /* apply locally */ }
    localStorage.removeItem('cinema_seats_default');
    await resetLayout();
    setAllBookings([]);
    setServerStats(null);
    notify('Cinema fully reset — all bookings cleared');
    setBtnLoading('');
  };

  // ── Toggle user active/inactive ────────────────────────────────────────────
  const handleToggleUser = async (userId) => {
    try {
      const { data } = await axios.put(`/api/auth/users/${userId}/toggle`, {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('cinema_token')}` }, timeout: 3000 });
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, isActive: data.user.isActive } : u));
      notify(`User ${data.user.isActive ? 'activated' : 'deactivated'}`);
    } catch { notify('User management requires a running backend', 'error'); }
  };

  // ── Derived counts ─────────────────────────────────────────────────────────
  const confirmed    = allBookings.filter(b => b.status === 'confirmed' || !b.status);
  const cancelled    = allBookings.filter(b => b.status === 'cancelled');
  const guestBks     = allBookings.filter(b => b.userType === 'guest');
  const uniqueGuests = new Set(allBookings.filter(b => b.guestId).map(b => b.guestId)).size;

  const seatBreakdown = [
    { label:'Total',       value: seats.length,                                                        color:'#f1f5f9' },
    { label:'Available',   value: seats.filter(s=>s.status==='available').length,                      color:'#3b82f6' },
    { label:'Booked',      value: seats.filter(s=>s.status==='booked').length,                         color:'#ef4444' },
    { label:'Broken',      value: seats.filter(s=>s.type==='broken').length,                           color:'#6b7280' },
    { label:'VIP Avail',   value: seats.filter(s=>s.type==='vip'&&s.status==='available').length,      color:'#e8b84b' },
    { label:'Disab. Avail',value: seats.filter(s=>s.type==='disability'&&s.status==='available').length, color:'#38bdf8' },
  ];

  const TABS = [
    { key:'overview', label:'Overview' },
    { key:'bookings', label:`Bookings (${allBookings.length})` },
    { key:'users',    label:`Users (${users.length})` },
    { key:'seats',    label:'Seat Map' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily:'"DM Serif Display",serif', fontSize:'2rem', color:'#f1f5f9' }}>
            Admin Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color:'#64748b' }}>
            Logged in as <span style={{ color:'#e8b84b' }}>{user?.name}</span>
            {user?.isLocal && <span className="ml-2 text-xs px-2 py-0.5 rounded"
               style={{ background:'rgba(100,116,139,0.1)', color:'#64748b' }}>offline mode</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-full text-xs"
               style={{ background:'rgba(232,184,75,0.1)', color:'#e8b84b', border:'1px solid rgba(232,184,75,0.2)' }}>
            👑 Admin
          </div>
          <Btn onClick={loadAll} loading={dataLoading} variant="default">
            ↺ Refresh
          </Btn>
        </div>
      </div>

      <div className="mb-6"><StatsBar stats={stats} /></div>

      {/* Notification banner */}
      {msg.text && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
             style={{
               background: msg.type==='success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
               border:    `1px solid ${msg.type==='success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
               color:      msg.type==='success' ? '#22c55e' : '#fca5a5',
             }}>
          <span>{msg.type==='success'?'✓':'✗'}</span>
          <span>{msg.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit"
           style={{ background:'#12121a', border:'1px solid #2a2a3e' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: tab===t.key ? '#1a1a26' : 'transparent',
              color:      tab===t.key ? '#e8b84b' : '#64748b',
              border:     tab===t.key ? '1px solid #2a2a3e' : '1px solid transparent',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Seat override panel */}
          <div className="rounded-xl p-5" style={{ background:'#1a1a26', border:'1px solid #2a2a3e' }}>
            <h3 className="font-semibold mb-4 text-sm" style={{ color:'#e8b84b' }}>Seat Override</h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs mb-1" style={{ color:'#64748b' }}>Row</label>
                  <input value={overrideForm.row} maxLength={1}
                    onChange={e => setOverrideForm(f=>({...f, row:e.target.value.toUpperCase()}))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none text-center font-mono font-bold"
                    style={{ background:'#12121a', border:'1px solid #2a2a3e', color:'#e8b84b' }} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs mb-1" style={{ color:'#64748b' }}>Seat #</label>
                  <input type="number" min={1} max={28} value={overrideForm.number}
                    onChange={e => setOverrideForm(f=>({...f, number:e.target.value}))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background:'#12121a', border:'1px solid #2a2a3e', color:'#f1f5f9' }} />
                </div>
              </div>
              <select value={overrideForm.action}
                onChange={e => setOverrideForm(f=>({...f, action:e.target.value}))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background:'#12121a', border:'1px solid #2a2a3e', color:'#f1f5f9' }}>
                <option value="break">Mark as Broken</option>
                <option value="restore">Restore Seat</option>
                <option value="book">Force Book</option>
              </select>
              <Btn onClick={applyOverride} loading={btnLoading==='override'} variant="purple" className="w-full">
                Apply Override
              </Btn>
            </div>
          </div>

          {/* Analytics */}
          <div className="rounded-xl p-5" style={{ background:'#1a1a26', border:'1px solid #2a2a3e' }}>
            <h3 className="font-semibold mb-4 text-sm" style={{ color:'#e8b84b' }}>Booking Analytics</h3>
            <div className="space-y-2 mb-4">
              {[
                { label:'Total Bookings',   value: allBookings.length,  color:'#f1f5f9' },
                { label:'Confirmed',        value: confirmed.length,    color:'#22c55e' },
                { label:'Cancelled',        value: cancelled.length,    color:'#ef4444' },
                { label:'Guest Bookings',   value: guestBks.length,     color:'#94a3b8' },
                { label:'Unique Guests',    value: uniqueGuests,        color:'#64748b' },
                { label:'Registered Users', value: users.length,        color:'#3b82f6' },
              ].map(item => (
                <div key={item.label} className="flex justify-between text-sm py-1.5"
                     style={{ borderBottom:'1px solid #12121a' }}>
                  <span style={{ color:'#64748b' }}>{item.label}</span>
                  <span className="font-mono font-bold" style={{ color:item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
            {/* Occupancy bar */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color:'#64748b' }}>Occupancy</span>
                <span className="font-mono" style={{ color:'#e8b84b' }}>{stats.occupancyPct}%</span>
              </div>
              <div className="h-2 rounded-full" style={{ background:'#2a2a3e' }}>
                <div className="h-full rounded-full transition-all duration-500"
                     style={{ width:`${stats.occupancyPct}%`, background:'linear-gradient(90deg,#e8b84b,#c89530)' }} />
              </div>
            </div>
          </div>

          {/* Actions + seat breakdown */}
          <div className="space-y-4">
            <div className="rounded-xl p-5" style={{ background:'#1a1a26', border:'1px solid #2a2a3e' }}>
              <h3 className="font-semibold mb-3 text-sm" style={{ color:'#e8b84b' }}>Quick Actions</h3>
              <div className="space-y-2">
                <Btn onClick={handleGenerateBroken} loading={btnLoading==='broken'} variant="warning" className="w-full">
                  🔧 Generate Broken Seats
                </Btn>
                <Btn onClick={handleReset} loading={btnLoading==='reset'} variant="danger" className="w-full">
                  ↺ Full Cinema Reset
                </Btn>
              </div>
            </div>
            <div className="rounded-xl p-5" style={{ background:'#1a1a26', border:'1px solid #2a2a3e' }}>
              <h3 className="font-semibold mb-3 text-sm" style={{ color:'#e8b84b' }}>Seat Breakdown</h3>
              {seatBreakdown.map(item => (
                <div key={item.label} className="flex justify-between text-sm py-1.5"
                     style={{ borderBottom:'1px solid #12121a' }}>
                  <span style={{ color:'#64748b' }}>{item.label}</span>
                  <span className="font-mono font-bold" style={{ color:item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── BOOKINGS ── */}
      {tab === 'bookings' && (
        <div className="rounded-xl p-5" style={{ background:'#1a1a26', border:'1px solid #2a2a3e' }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-semibold text-sm" style={{ color:'#e8b84b' }}>
              All Bookings ({allBookings.length})
            </h3>
            <div className="flex gap-3 text-xs flex-wrap">
              <span style={{ color:'#22c55e' }}>● {confirmed.length} confirmed</span>
              <span style={{ color:'#ef4444' }}>● {cancelled.length} cancelled</span>
              <span style={{ color:'#94a3b8' }}>● {guestBks.length} guest</span>
            </div>
          </div>
          {allBookings.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-2">📋</div>
              <p className="text-sm" style={{ color:'#475569' }}>No bookings recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allBookings.map((b, idx) => (
                <div key={b.bookingRef || idx}
                     className="flex items-start justify-between p-3 rounded-lg gap-3"
                     style={{ background:'#12121a' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs font-bold" style={{ color:'#e8b84b' }}>
                        {b.bookingRef}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{
                              background: (b.status==='confirmed'||!b.status) ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                              color:      (b.status==='confirmed'||!b.status) ? '#22c55e' : '#ef4444',
                            }}>
                        {b.status||'confirmed'}
                      </span>
                      {b.userType==='guest' && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full"
                              style={{ background:'rgba(100,116,139,0.1)', color:'#94a3b8' }}>
                          guest
                        </span>
                      )}
                      {b.isAdminOverride && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full"
                              style={{ background:'rgba(124,58,237,0.1)', color:'#a855f7' }}>
                          override
                        </span>
                      )}
                    </div>
                    <div className="text-xs mb-1" style={{ color:'#94a3b8' }}>
                      {b.customerName}
                      {b.userId?.email && <span className="ml-2" style={{ color:'#475569' }}>{b.userId.email}</span>}
                      <span className="ml-2" style={{ color:'#475569' }}>×{b.groupSize} seats</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(b.seats||[]).map(s => (
                        <span key={`${s.row}${s.number}`}
                              className="text-xs font-mono px-1.5 py-0.5 rounded"
                              style={{ background:'rgba(59,130,246,0.1)', color:'#93c5fd' }}>
                          {s.row}{s.number}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-xs" style={{ color:'#334155' }}>
                      {b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-GB') : ''}
                    </span>
                    {(b.status==='confirmed'||!b.status) && (
                      <Btn onClick={() => handleCancelBooking(b.bookingRef)}
                        loading={btnLoading===`cancel_${b.bookingRef}`}
                        variant="danger" className="px-2 py-1 text-xs">
                        Cancel
                      </Btn>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── USERS ── */}
      {tab === 'users' && (
        <div className="rounded-xl p-5" style={{ background:'#1a1a26', border:'1px solid #2a2a3e' }}>
          <h3 className="font-semibold mb-4 text-sm" style={{ color:'#e8b84b' }}>
            Registered Users ({users.length})
          </h3>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-2">👤</div>
              <p className="text-sm mb-1" style={{ color:'#475569' }}>No registered users yet.</p>
              <p className="text-xs" style={{ color:'#334155' }}>
                Users appear here once the backend is running and someone registers.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((u, idx) => (
                <div key={u._id||idx}
                     className="flex items-center justify-between p-3 rounded-lg gap-3"
                     style={{ background:'#12121a' }}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                         style={{
                           background: u.role==='admin' ? 'rgba(232,184,75,0.15)' : 'rgba(59,130,246,0.15)',
                           color:      u.role==='admin' ? '#e8b84b' : '#93c5fd',
                         }}>
                      {u.name?.[0]?.toUpperCase()||'?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium" style={{ color:'#f1f5f9' }}>{u.name}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full"
                              style={{
                                background: u.role==='admin' ? 'rgba(232,184,75,0.1)' : 'rgba(59,130,246,0.1)',
                                color:      u.role==='admin' ? '#e8b84b' : '#93c5fd',
                              }}>
                          {u.role}
                        </span>
                        {!u.isActive && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full"
                                style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444' }}>
                            inactive
                          </span>
                        )}
                      </div>
                      <div className="text-xs truncate" style={{ color:'#64748b' }}>{u.email}</div>
                      <div className="text-xs mt-0.5" style={{ color:'#475569' }}>
                        {u.bookingCounts
                          ? `${u.bookingCounts.confirmed} confirmed · ${u.bookingCounts.cancelled} cancelled`
                          : 'Booking data unavailable'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs hidden sm:block" style={{ color:'#334155' }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : ''}
                    </span>
                    <Btn onClick={() => handleToggleUser(u._id)}
                      variant={u.isActive ? 'danger' : 'success'} className="text-xs">
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          )}

          {uniqueGuests > 0 && (
            <div className="mt-4 p-3 rounded-lg"
                 style={{ background:'rgba(100,116,139,0.05)', border:'1px solid rgba(100,116,139,0.15)' }}>
              <div className="text-xs font-semibold mb-1" style={{ color:'#94a3b8' }}>Guest Activity</div>
              <div className="text-xs" style={{ color:'#64748b' }}>
                {uniqueGuests} unique guest session{uniqueGuests>1?'s':''} · {guestBks.length} total guest booking{guestBks.length!==1?'s':''}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SEAT MAP ── */}
      {tab === 'seats' && (
        <div className="rounded-xl p-6" style={{ background:'#1a1a26', border:'1px solid #2a2a3e' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color:'#e8b84b' }}>Live Seat Map</h2>
            <div className="flex gap-2">
              <Btn onClick={handleGenerateBroken} loading={btnLoading==='broken'} variant="warning">
                🔧 Generate Broken
              </Btn>
              <Btn onClick={handleReset} loading={btnLoading==='reset'} variant="danger">
                ↺ Reset Cinema
              </Btn>
            </div>
          </div>
          {seats.length > 0
            ? <SeatGrid seats={seats} />
            : <div className="flex items-center justify-center h-48 text-sm" style={{ color:'#475569' }}>
                No layout loaded — click Refresh
              </div>}
        </div>
      )}
    </div>
  );
}
