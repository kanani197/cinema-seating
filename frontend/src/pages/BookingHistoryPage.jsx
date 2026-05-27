import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { getLocalBookings, cancelBookingLocally } from '../context/CinemaContext';
import { calculateFragmentationClient } from '../utils/algorithmClient';
import { buildInMemoryLayout } from '../utils/layoutBuilder';

export default function BookingHistoryPage() {
  const { user, isGuest } = useAuth();
  const [bookings,      setBookings]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [cancelResult,  setCancelResult]  = useState(null); // {bookingRef, fragBefore, fragAfter}
  const [cancelLoading, setCancelLoading] = useState(null);

  const loadBookings = async () => {
    setLoading(true);
    let local = isGuest
      ? getLocalBookings(null, user?.guestId)
      : getLocalBookings(user?.email);

    if (user && !isGuest && !user.isLocal) {
      try {
        const { data } = await axios.get('/api/bookings/my', { timeout: 4000 });
        const apiRefs  = new Set((data.bookings || []).map(b => b.bookingRef));
        const localOnly = local.filter(b => !apiRefs.has(b.bookingRef));
        setBookings([...(data.bookings || []), ...localOnly]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        setLoading(false); return;
      } catch { /* fallthrough */ }
    }
    setBookings(local);
    setLoading(false);
  };

  useEffect(() => { loadBookings(); }, [user]);

  const handleCancel = async (bookingRef) => {
    setCancelLoading(bookingRef);
    setCancelResult(null);

    // Calculate fragmentation BEFORE
    const SEAT_KEY = 'cinema_seats_default';
    let seatsBefore = [];
    try { seatsBefore = JSON.parse(localStorage.getItem(SEAT_KEY) || '[]'); } catch {}
    if (!seatsBefore.length) seatsBefore = buildInMemoryLayout('default');
    const fragBefore = calculateFragmentationClient(seatsBefore).fragmentationScore;

    try {
      await axios.post('/api/bookings/cancel', { bookingRef, guestId: user?.guestId }, { timeout: 4000 });
    } catch { /* apply locally */ }

    cancelBookingLocally(bookingRef);

    // Update local seat state to free those seats
    const booking = bookings.find(b => b.bookingRef === bookingRef);
    let seatsAfter = seatsBefore;
    if (booking?.seats) {
      seatsAfter = seatsBefore.map(s => {
        const freed = booking.seats.some(bs => bs.row === s.row && bs.number === s.number);
        return freed ? { ...s, status: 'available' } : s;
      });
      try { localStorage.setItem(SEAT_KEY, JSON.stringify(seatsAfter)); } catch {}
    }
    const fragAfter = calculateFragmentationClient(seatsAfter).fragmentationScore;

    setCancelResult({ bookingRef, fragBefore, fragAfter, seatsFreed: booking?.seats?.length || 0 });
    setCancelLoading(null);
    setTimeout(() => setCancelResult(null), 5000);
    loadBookings();
  };

  const Pill = ({ status }) => (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
          style={{
            background: status === 'confirmed' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color:      status === 'confirmed' ? '#22c55e' : '#ef4444',
            border:    `1px solid ${status === 'confirmed' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
      {status || 'confirmed'}
    </span>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '2rem', color: '#f1f5f9' }}>
            My Bookings
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            {isGuest ? 'Guest session bookings'
              : user?.isLocal ? `${user.email} (offline)` : user?.email}
          </p>
        </div>
        <Link to="/book"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg,#e8b84b,#c89530)', color: '#0a0a0f' }}>
          + New Booking
        </Link>
      </div>

      {/* Cancellation reallocation visual */}
      {cancelResult && (
        <div className="mb-4 rounded-xl p-4"
             style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <div className="font-semibold text-sm mb-2" style={{ color: '#22c55e' }}>
            ✓ Booking {cancelResult.bookingRef} cancelled — {cancelResult.seatsFreed} seat{cancelResult.seatsFreed!==1?'s':''} released
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <div style={{ color: '#64748b' }}>Fragmentation before</div>
              <div className="font-mono font-bold mt-0.5" style={{ color: '#e8b84b' }}>
                {cancelResult.fragBefore}%
              </div>
            </div>
            <div className="flex items-center justify-center">
              <span style={{ color: '#22c55e', fontSize: 18 }}>→</span>
            </div>
            <div>
              <div style={{ color: '#64748b' }}>Fragmentation after</div>
              <div className="font-mono font-bold mt-0.5"
                   style={{ color: cancelResult.fragAfter <= cancelResult.fragBefore ? '#22c55e' : '#e8b84b' }}>
                {cancelResult.fragAfter}%
                {cancelResult.fragAfter < cancelResult.fragBefore && (
                  <span className="ml-1" style={{ color: '#22c55e' }}>
                    ↓ ({cancelResult.fragBefore - cancelResult.fragAfter}% reduced)
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: '#64748b' }}>
            Released seats are now available for reallocation. Optimisation algorithm will prefer these positions.
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16" style={{ color: '#64748b' }}>
          <div className="text-2xl mb-2">⏳</div>
          Loading bookings…
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 rounded-2xl"
             style={{ background: '#1a1a26', border: '1px solid #2a2a3e' }}>
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-sm" style={{ color: '#64748b' }}>No bookings yet.</p>
          <Link to="/book" className="mt-3 inline-block text-sm" style={{ color: '#e8b84b' }}>
            Book your first seats →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b, idx) => (
            <div key={b.bookingRef || idx} className="rounded-xl p-5 card-hover"
                 style={{ background: '#1a1a26', border: '1px solid #2a2a3e' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-mono font-bold text-sm" style={{ color: '#e8b84b' }}>
                      {b.bookingRef}
                    </span>
                    <Pill status={b.status} />
                    {b.userType === 'guest' && (
                      <span className="px-2 py-0.5 rounded-full text-xs"
                            style={{ background: 'rgba(100,116,139,0.1)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.3)' }}>
                        Guest
                      </span>
                    )}
                  </div>
                  <div className="text-sm mb-2" style={{ color: '#f1f5f9' }}>
                    {b.customerName} · {b.groupSize} seat{b.groupSize > 1 ? 's' : ''}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(b.seats || []).map(s => (
                      <span key={`${s.row}${s.number}`}
                            className="px-2 py-0.5 rounded text-xs font-mono"
                            style={{
                              background: (s.seatType || s.type) === 'vip' ? 'rgba(232,184,75,0.1)' : 'rgba(59,130,246,0.1)',
                              border: `1px solid ${(s.seatType || s.type) === 'vip'?'rgba(232,184,75,0.3)':'rgba(59,130,246,0.3)'}`,
                              color:  (s.seatType || s.type) === 'vip' ? '#e8b84b' : '#93c5fd',
                            }}>
                        {s.row}{s.number}{(s.seatType || s.type) === 'vip' ? ' ★' : ''}
                      </span>
                    ))}
                  </div>
                  {b.allocationNotes && (
                    <div className="text-xs" style={{ color: '#475569' }}>
                      {b.allocationNotes}
                      {b.allocationScore !== undefined && (
                        <span className="ml-2 font-mono" style={{ color: '#e8b84b' }}>
                          Score: {Number(b.allocationScore).toFixed(1)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="text-xs" style={{ color: '#475569' }}>
                    {b.createdAt
                      ? new Date(b.createdAt).toLocaleDateString('en-GB',
                          { day:'numeric', month:'short', year:'numeric' })
                      : '—'}
                  </div>
                  {(b.status === 'confirmed' || !b.status) && (
                    <button
                      onClick={() => handleCancel(b.bookingRef)}
                      disabled={cancelLoading === b.bookingRef}
                      className="px-3 py-1 rounded-lg text-xs transition-all"
                      style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: '#fca5a5',
                        opacity: cancelLoading === b.bookingRef ? 0.5 : 1,
                      }}>
                      {cancelLoading === b.bookingRef ? 'Cancelling…' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
