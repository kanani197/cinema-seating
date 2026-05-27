import React from 'react';
import { Link } from 'react-router-dom';
import { useCinema } from '../context/CinemaContext';

const ROW_TIER = { A:4,B:4,C:3,D:3,E:2,F:2,G:1,H:1,I:1,J:1,K:2,L:2,M:3,N:3,O:4 };

export default function ConfirmationPage() {
  const { lastBooking } = useCinema();

  if (!lastBooking) {
    return (
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <p style={{ color: '#64748b' }}>No booking found.</p>
        <Link to="/book" className="mt-4 inline-block text-sm" style={{ color: '#e8b84b' }}>
          Make a booking →
        </Link>
      </div>
    );
  }

  const booking  = lastBooking.booking || lastBooking;
  const seats    = lastBooking.allocatedSeats || booking.seats || [];
  const score    = lastBooking.allocationScore ?? booking.allocationScore;
  const notes    = lastBooking.allocationNotes ?? booking.allocationNotes;
  const stats    = lastBooking.stats;

  // Build optimisation explanation
  const row      = seats[0]?.row;
  const tier     = ROW_TIER[row] || 4;
  const cols     = seats.map(s => s.number);
  const centred  = cols.filter(c => c >= 10 && c <= 18).length;
  const orphanFree = (score ?? 0) >= 0;

  const reasons = [];
  if (seats.length === booking.groupSize) reasons.push({ icon: '👥', text: `Group of ${booking.groupSize} kept together in row ${row}`, c: '#22c55e' });
  if (centred === cols.length)            reasons.push({ icon: '🎯', text: 'Fully centred seats selected — optimal viewing angle', c: '#22c55e' });
  else if (centred > 0)                   reasons.push({ icon: '🎯', text: 'Partially centred — best available central position', c: '#e8b84b' });
  if (tier <= 2)                          reasons.push({ icon: '⭐', text: `Prime row ${row} — ${tier===1?'optimal':'good'} distance from screen`, c: '#22c55e' });
  if (orphanFree)                         reasons.push({ icon: '✅', text: 'No isolated seat gaps created — layout fragmentation minimised', c: '#22c55e' });
  else                                    reasons.push({ icon: '⚠️', text: 'Minor fragmentation unavoidable at current occupancy — best option selected', c: '#e8b84b' });
  if (booking.groupSize === 1)            reasons.push({ icon: '🪑', text: 'Solo booker — edge/aisle preference applied, centre preserved for groups', c: '#3b82f6' });

  const scoreLabel = score >= 20 ? 'Excellent' : score >= 12 ? 'High Quality' : score >= 4 ? 'Good' : 'Best Available';
  const scoreColor = score >= 20 ? '#22c55e'   : score >= 12 ? '#86efac'       : score >= 4 ? '#e8b84b' : '#94a3b8';

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      {/* Success banner */}
      <div className="rounded-2xl p-7 mb-5 text-center"
           style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}>
        <div className="text-5xl mb-3">🎬</div>
        <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.9rem', color: '#22c55e' }}>
          Booking Confirmed!
        </h1>
        <p className="mt-2 text-sm" style={{ color: '#64748b' }}>
          Optimisation algorithm selected the best available seats.
        </p>
      </div>

      {/* Reference */}
      <div className="rounded-xl p-5 mb-4" style={{ background: '#1a1a26', border: '1px solid #2a2a3e' }}>
        <div className="flex justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs mb-1" style={{ color: '#64748b' }}>Booking Reference</div>
            <div className="font-mono font-bold text-xl" style={{ color: '#e8b84b' }}>
              {booking.bookingRef}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs mb-1" style={{ color: '#64748b' }}>Customer</div>
            <div className="font-medium" style={{ color: '#f1f5f9' }}>{booking.customerName}</div>
            <div className="text-xs" style={{ color: '#475569' }}>{booking.customerEmail}</div>
          </div>
        </div>
      </div>

      {/* Seats */}
      <div className="rounded-xl p-5 mb-4" style={{ background: '#1a1a26', border: '1px solid #2a2a3e' }}>
        <div className="text-xs mb-3" style={{ color: '#64748b' }}>
          Allocated Seats — {seats.length} seat{seats.length !== 1 ? 's' : ''}
        </div>
        <div className="flex flex-wrap gap-2">
          {seats.map(s => (
            <div key={`${s.row}${s.number}`}
                 className="px-3 py-2 rounded-lg font-mono font-bold text-sm"
                 style={{
                   background: (s.seatType || s.type) === 'vip' ? 'rgba(232,184,75,0.15)'
                     : (s.seatType || s.type) === 'disability' ? 'rgba(56,189,248,0.15)' : 'rgba(59,130,246,0.15)',
                   border: `1px solid ${(s.seatType || s.type) === 'vip' ? '#e8b84b' : (s.seatType || s.type) === 'disability' ? '#38bdf8' : '#3b82f6'}`,
                   color:  (s.seatType || s.type) === 'vip' ? '#e8b84b' : (s.seatType || s.type) === 'disability' ? '#38bdf8' : '#93c5fd',
                 }}>
              {s.row}{s.number}
              {(s.seatType || s.type) === 'vip' && <span className="ml-1 text-xs">★ VIP</span>}
              {(s.seatType || s.type) === 'disability' && <span className="ml-1 text-xs">♿</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Optimisation explanation */}
      <div className="rounded-xl p-5 mb-4"
           style={{ background: 'rgba(232,184,75,0.02)', border: '1px solid rgba(232,184,75,0.15)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#e8b84b' }}>
            Optimisation Reasoning
          </div>
          {score !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#64748b' }}>Score:</span>
              <span className="font-mono font-bold text-sm" style={{ color: scoreColor }}>
                {Number(score).toFixed(1)}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: `${scoreColor}18`, color: scoreColor, border: `1px solid ${scoreColor}44` }}>
                {scoreLabel}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2 mb-3">
          {reasons.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span>{r.icon}</span>
              <span style={{ color: r.c }}>{r.text}</span>
            </div>
          ))}
        </div>

        {notes && (
          <div className="text-xs pt-2" style={{ color: '#475569', borderTop: '1px solid #2a2a3e' }}>
            {notes}
          </div>
        )}
      </div>

      {/* Live stats after booking */}
      {stats && (
        <div className="rounded-xl p-4 mb-5 grid grid-cols-3 gap-3"
             style={{ background: '#12121a', border: '1px solid #2a2a3e' }}>
          <div className="text-center">
            <div className="text-xs mb-1" style={{ color: '#64748b' }}>Occupancy</div>
            <div className="font-mono font-bold text-lg" style={{ color: '#e8b84b' }}>
              {stats.occupancyPct}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs mb-1" style={{ color: '#64748b' }}>Fragmentation</div>
            <div className="font-mono font-bold text-lg"
                 style={{ color: stats.fragmentationScore < 10 ? '#22c55e' : '#e8b84b' }}>
              {stats.fragmentationScore}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs mb-1" style={{ color: '#64748b' }}>Isolated Gaps</div>
            <div className="font-mono font-bold text-lg"
                 style={{ color: stats.isolatedCount === 0 ? '#22c55e' : '#e8b84b' }}>
              {stats.isolatedCount}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Link to="/book"
          className="flex-1 py-3 rounded-xl text-center text-sm font-semibold hover:opacity-90"
          style={{ background: 'linear-gradient(135deg,#e8b84b,#c89530)', color: '#0a0a0f' }}>
          Book More Seats
        </Link>
        <Link to="/my-bookings"
          className="px-5 py-3 rounded-xl text-sm font-medium"
          style={{ background: '#1a1a26', border: '1px solid #2a2a3e', color: '#94a3b8' }}>
          My Bookings
        </Link>
      </div>
    </div>
  );
}
