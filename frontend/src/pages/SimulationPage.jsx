import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCinema } from '../context/CinemaContext';
import SeatGrid from '../components/seats/SeatGrid';
import StatsBar from '../components/StatsBar';
import { simulateOccupancyClient, calculateFragmentationClient } from '../utils/algorithmClient';
import { buildInMemoryLayout } from '../utils/layoutBuilder';

const SCENARIOS = [
  { key: 'half',        label: '50% Full',      icon: '📊', color: '#22c55e',
    desc: 'Normal evening — algorithm clusters bookings and prevents gaps.' },
  { key: 'crowded',     label: '75% Full',      icon: '⚡', color: '#e8b84b',
    desc: 'Busy weekend — algorithm under pressure to maintain cohesion.' },
  { key: 'nearly_full', label: '90% Full',      icon: '🔥', color: '#ef4444',
    desc: 'Sold-out — maximum stress test. Observe orphan prevention limits.' },
  { key: 'random',      label: 'Random Stress', icon: '🎲', color: '#a855f7',
    desc: 'Random 30–95% density with unpredictable group size patterns.' },
];

// Key used to pass sim state to booking page via localStorage
const SIM_HANDOFF_KEY = 'cinema_sim_handoff';

export default function SimulationPage() {
  const { dispatch } = useCinema();
  const navigate = useNavigate();

  const [simSeats,  setSimSeats]  = useState([]);
  const [simStats,  setSimStats]  = useState({ occupancyPct:0, fragmentationScore:0, isolatedCount:0 });
  const [simResult, setSimResult] = useState(null);
  const [history,   setHistory]   = useState([]);
  const [running,   setRunning]   = useState(false);
  const [activeKey, setActiveKey] = useState(null);
  const [applied,   setApplied]   = useState(false);

  const runSim = (scenarioKey) => {
    setRunning(true);
    setActiveKey(scenarioKey);
    setApplied(false);
    setTimeout(() => {
      const density = scenarioKey === 'random'
        ? ['half','crowded','nearly_full'][Math.floor(Math.random()*3)]
        : scenarioKey;
      const fresh  = buildInMemoryLayout(`sim_${Date.now()}`);
      const result = simulateOccupancyClient(fresh, density);
      setSimSeats(result.seats);
      setSimStats(result.stats);
      const r = { ...result, scenario: scenarioKey, density, ts: new Date().toLocaleTimeString() };
      setSimResult(r);
      setHistory(h => [r, ...h.slice(0,4)]);
      setRunning(false);
    }, 400);
  };

  /**
   * Apply simulation to booking page.
   * Strategy: write sim seats to a dedicated localStorage key (SIM_HANDOFF_KEY)
   * AND to the main seat cache, then navigate. BookingPage reads SIM_HANDOFF_KEY
   * on mount and uses it directly — no API call, no race condition.
   */
  const applyToBookingPage = () => {
    if (!simSeats.length) return;

    // Re-tag seats to 'default' session so booking page recognises them
    const handoffSeats = simSeats.map(s => ({
      ...s,
      _id:       `${s.row}_${s.number}`,
      sessionId: 'default',
    }));

    // Write to localStorage (belt)
    try {
      localStorage.setItem(SIM_HANDOFF_KEY, JSON.stringify(handoffSeats));
      localStorage.setItem('cinema_seats_default', JSON.stringify(handoffSeats));
    } catch (e) { /* storage full — ignore */ }

    setApplied(true);
    // Pass seats via React Router state (suspenders) — completely synchronous, no timing issues
    navigate('/book', { state: { simSeats: handoffSeats, simApplied: true } });
  };

  const FragBar = ({ value, label, color }) => (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color:'#94a3b8' }}>{label}</span>
        <span className="font-mono font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background:'#2a2a3e' }}>
        <div className="h-full rounded-full transition-all duration-700"
             style={{ width:`${Math.min(value,100)}%`, background: color }} />
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 style={{ fontFamily:'"DM Serif Display",serif', fontSize:'2rem', color:'#f1f5f9' }}>
          Simulation Mode
        </h1>
        <p className="text-sm mt-1" style={{ color:'#64748b' }}>
          Stress-test the optimisation algorithm. Use{' '}
          <strong style={{ color:'#e8b84b' }}>"→ Apply to Booking Page"</strong>{' '}
          to book seats into this crowded cinema.
        </p>
      </div>

      {/* Scenario buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {SCENARIOS.map(s => (
          <button key={s.key} onClick={() => runSim(s.key)} disabled={running}
            className="rounded-xl p-4 text-left transition-all"
            style={{
              background: activeKey===s.key
                ? `rgba(${s.key==='half'?'34,197,94':s.key==='crowded'?'232,184,75':s.key==='nearly_full'?'239,68,68':'168,85,247'},0.1)` : '#1a1a26',
              border:  activeKey===s.key ? `2px solid ${s.color}` : '1px solid #2a2a3e',
              opacity: running && activeKey!==s.key ? 0.4 : 1,
              cursor:  running ? 'not-allowed' : 'pointer',
            }}>
            <div className="text-2xl mb-2">{running && activeKey===s.key ? '⏳' : s.icon}</div>
            <div className="font-semibold text-sm mb-1" style={{ color:s.color }}>{s.label}</div>
            <p className="text-xs" style={{ color:'#64748b', lineHeight:1.5 }}>{s.desc}</p>
          </button>
        ))}
      </div>

      <div className="mb-5"><StatsBar stats={simStats} /></div>

      {/* Results */}
      {simResult && (
        <div className="rounded-xl p-5 mb-5" style={{ background:'#12121a', border:'1px solid #2a2a3e' }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color:'#e8b84b' }}>
              Results — {SCENARIOS.find(s=>s.key===activeKey)?.label}
            </div>
            <button onClick={applyToBookingPage} disabled={applied || !simSeats.length}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: applied ? 'rgba(34,197,94,0.15)' : 'linear-gradient(135deg,#e8b84b,#c89530)',
                color:  applied ? '#22c55e' : '#0a0a0f',
                border: applied ? '1px solid rgba(34,197,94,0.4)' : 'none',
                cursor: applied ? 'default' : 'pointer',
              }}>
              {applied ? '✓ Applied — Go to Booking Page' : '→ Apply to Booking Page'}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-5">
            {[
              { label:'Bookings Placed',      value: simResult.bookingsCreated   || '—', color:'#f1f5f9' },
              { label:'Groups Kept Together', value: simResult.groupsKeptTogether || '—', color:'#22c55e' },
              { label:'Orphans Prevented',    value: simResult.orphansPrevented   || '—', color:'#3b82f6' },
              { label:'Final Occupancy',      value: `${simResult.stats?.occupancyPct}%`,  color:'#e8b84b' },
            ].map(item => (
              <div key={item.label}>
                <div className="text-xs mb-1" style={{ color:'#64748b' }}>{item.label}</div>
                <div className="text-2xl font-mono font-bold" style={{ color:item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <FragBar value={simResult.stats?.occupancyPct      || 0} label="Occupancy"                      color="#e8b84b" />
            <FragBar value={simResult.stats?.fragmentationScore || 0} label="Fragmentation (lower = better)" color="#ef4444" />
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="rounded-xl p-4 mb-5" style={{ background:'#1a1a26', border:'1px solid #2a2a3e' }}>
          <div className="text-xs font-semibold mb-3" style={{ color:'#e8b84b' }}>Run History</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color:'#64748b' }}>
                  <th className="text-left pb-2">Scenario</th>
                  <th className="text-right pb-2">Occupancy</th>
                  <th className="text-right pb-2">Fragmentation</th>
                  <th className="text-right pb-2">Orphans Prevented</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h,i) => (
                  <tr key={i} style={{ borderTop:'1px solid #2a2a3e', color: i===0?'#f1f5f9':'#64748b' }}>
                    <td className="py-1.5">{SCENARIOS.find(s=>s.key===h.scenario)?.label || h.scenario}
                      {i===0&&<span className="ml-2 text-xs" style={{ color:'#e8b84b' }}>latest</span>}</td>
                    <td className="text-right font-mono">{h.stats?.occupancyPct}%</td>
                    <td className="text-right font-mono">{h.stats?.fragmentationScore}%</td>
                    <td className="text-right font-mono">{h.orphansPrevented||0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Seat grid */}
      <div className="rounded-xl p-5" style={{ background:'#1a1a26', border:'1px solid #2a2a3e' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold" style={{ color:'#e8b84b' }}>
            {simResult ? 'Simulated Layout' : 'Select a scenario above'}
          </h2>
          <span className="text-xs" style={{ color:'#64748b' }}>
            Read-only — click "Apply to Booking Page" to book into this layout
          </span>
        </div>
        {simSeats.length > 0
          ? <SeatGrid seats={simSeats} />
          : <div className="flex items-center justify-center h-48 text-sm" style={{ color:'#475569' }}>
              Click a scenario above to run the simulation
            </div>}
      </div>

      <div className="mt-5 rounded-xl p-5" style={{ background:'#12121a', border:'1px solid #2a2a3e' }}>
        <h3 className="font-semibold text-sm mb-3" style={{ color:'#e8b84b' }}>
          Algorithm Behaviour in Crowded Cinemas
        </h3>
        <div className="grid md:grid-cols-2 gap-3 text-xs" style={{ color:'#94a3b8', lineHeight:1.7 }}>
          {[
            { n:'1', t:'Row Scan', b:'Each row is scanned for contiguous available blocks ≥ group size. Broken and booked seats terminate the run.' },
            { n:'2', t:'Orphan Simulation', b:'Each candidate is tested: would booking it leave a single isolated seat? That block scores −10 per orphan.' },
            { n:'3', t:'Scoring & Selection', b:'Score = group bonus (+10) + centre bonus (+8) + row tier − orphan penalties. Best score wins.' },
            { n:'4', t:'Graceful Degradation', b:'At high occupancy the algorithm accepts some fragmentation rather than refuse. It always picks the least-bad option.' },
          ].map(item => (
            <div key={item.n} className="flex gap-2.5">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                   style={{ background:'rgba(232,184,75,0.15)', color:'#e8b84b' }}>{item.n}</div>
              <div>
                <div className="font-semibold mb-0.5" style={{ color:'#f1f5f9' }}>{item.t}</div>
                <div>{item.b}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
