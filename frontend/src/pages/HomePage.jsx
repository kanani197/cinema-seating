import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCinema } from '../context/CinemaContext';
import StatsBar from '../components/StatsBar';

export default function HomePage() {
  const { user, continueAsGuest } = useAuth();
  const { loadSeats, stats, seats } = useCinema();
  const navigate = useNavigate();

  useEffect(() => { if (seats.length === 0) loadSeats(); }, []);

  const handleGuest = () => { continueAsGuest(); navigate('/book'); };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-block mb-4 px-4 py-1 rounded-full text-xs font-medium"
             style={{ background: 'rgba(232,184,75,0.1)', color: '#e8b84b',
                      border: '1px solid rgba(232,184,75,0.2)' }}>
          {/* Advanced Topics in Software Engineering · A3 */}
        </div>
        <h1 style={{ fontFamily: '"DM Serif Display",serif',
                     fontSize: 'clamp(2rem,5vw,3.2rem)', color: '#f1f5f9',
                     lineHeight: 1.1, marginBottom: 16 }}>
          Cinema Seating<br />
          <span style={{ color: '#e8b84b' }}>Optimisation System</span>
        </h1>
        <p className="text-base max-w-xl mx-auto" style={{ color: '#94a3b8', lineHeight: 1.7 }}>
          Intelligent seat allocation that prevents isolated single-seat gaps, keeps groups together,
          and maximises occupancy efficiency using a custom multi-factor scoring algorithm.
        </p>
      </div>

      {/* Live stats */}
      <div className="mb-10"><StatsBar stats={stats} /></div>

      {/* Scoring system */}
      <div className="rounded-xl p-6 mb-8" style={{ background: '#12121a', border: '1px solid #2a2a3e' }}>
        <h2 className="font-semibold mb-4 text-sm uppercase tracking-widest" style={{ color: '#e8b84b' }}>
          Algorithm Scoring System
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm font-mono">
          {[
            { score: '+10', desc: 'Group kept together',       c: '#22c55e' },
            { score: '+8',  desc: 'Centre seats (cols 10–18)', c: '#22c55e' },
            { score: '+5',  desc: 'Solo on edge seat',         c: '#22c55e' },
            { score: '-10', desc: 'Creates isolated gap',      c: '#ef4444' },
            { score: '+8',  desc: 'Tier-1 row (G–J)',          c: '#22c55e' },
            { score: '-3',  desc: 'Poor viewing row (A/B/O)',  c: '#ef4444' },
          ].map(item => (
            <div key={item.desc} className="flex items-start gap-2">
              <span className="font-bold shrink-0" style={{ color: item.c, minWidth: 32 }}>
                {item.score}
              </span>
              <span style={{ color: '#64748b' }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {[
          { icon: '🚫', title: 'Orphan Gap Prevention',   color: '#ef4444',
            desc: 'Every candidate block is scored. Bookings that create isolated single seats are penalised; the algorithm picks the arrangement with minimal fragmentation.' },
          { icon: '👥', title: 'Smart Group Booking',     color: '#3b82f6',
            desc: 'Groups of 1–7 are always placed consecutively in the same row. Solo bookers are directed to edge seats, preserving prime centre positions for groups.' },
          { icon: '⭐', title: 'VIP & Accessibility',     color: '#e8b84b',
            desc: 'Dedicated zones: VIP rows E–H cols 12–15, 6 adjacent disability seats in row A. Both zones have independent allocation logic.' },
          { icon: '📊', title: 'Stress Test Simulation',  color: '#22c55e',
            desc: 'Simulate 50%, 75%, 90% occupancy. Observe algorithm behaviour under pressure — fragmentation scores, group cohesion, and orphan prevention statistics.' },
        ].map(f => (
          <div key={f.title} className="rounded-xl p-5 card-hover"
               style={{ background: '#1a1a26', border: '1px solid #2a2a3e' }}>
            <div className="text-2xl mb-3">{f.icon}</div>
            <div className="font-semibold mb-2" style={{ color: f.color }}>{f.title}</div>
            <p className="text-sm" style={{ color: '#64748b', lineHeight: 1.6 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="flex flex-wrap gap-3 justify-center">
        {user && !user.isGuest ? (
          <Link to="/book"
            className="px-8 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg,#e8b84b,#c89530)', color: '#0a0a0f' }}>
            Book Seats →
          </Link>
        ) : (
          <>
            <Link to="/register"
              className="px-8 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg,#e8b84b,#c89530)', color: '#0a0a0f' }}>
              Get Started →
            </Link>
            <button onClick={handleGuest}
              className="px-8 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: '#1a1a26', border: '1px solid #2a2a3e', color: '#94a3b8' }}>
              Continue as Guest
            </button>
          </>
        )}
        <Link to="/simulate"
          className="px-8 py-3 rounded-xl font-semibold text-sm"
          style={{ background: '#1a1a26', border: '1px solid #2a2a3e', color: '#94a3b8' }}>
          Run Simulation
        </Link>
      </div>
    </div>
  );
}
