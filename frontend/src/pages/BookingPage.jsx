import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCinema, clearSeatCache } from '../context/CinemaContext';
import { useAuth } from '../context/AuthContext';
import SeatGrid from '../components/seats/SeatGrid';
import StatsBar from '../components/StatsBar';
import AlgorithmPanel from '../components/AlgorithmPanel';
import { allocateSeatsClient, calculateFragmentationClient } from '../utils/algorithmClient';

// Must match SimulationPage
const SIM_HANDOFF_KEY = 'cinema_sim_handoff';

export default function BookingPage() {
  const { seats, loadSeats, bookSeats, stats, loading, resetLayout, dispatch } = useCinema();
  const { user } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [form, setForm] = useState({
    customerName:    (!user?.isGuest && user?.name)  || '',
    customerEmail:   (!user?.isGuest && user?.email) || '',
    groupSize: 2, wantsVip: false, needsAccessible: false,
  });

  const [manualSeats,   setManualSeats]   = useState([]);
  const [selectionMode, setSelectionMode] = useState('auto');
  const [preview,       setPreview]       = useState([]);
  const [previewScore,  setPreviewScore]  = useState(null);
  const [previewNotes,  setPreviewNotes]  = useState('');
  const [error,         setError]         = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [simMode,       setSimMode]       = useState(false);
  const prevStatsRef = useRef(null);

  // ── Mount: check for simulation handoff first, otherwise load normally ───────
  useEffect(() => {
    // Priority 1: React Router state (synchronous, passed directly from SimulationPage)
    if (location.state?.simApplied && Array.isArray(location.state?.simSeats) && location.state.simSeats.length > 50) {
      const simSeats = location.state.simSeats;
      // Clear the router state so a back-navigation doesn't re-apply
      window.history.replaceState({}, '', window.location.pathname);
      // Clear any localStorage handoff too
      localStorage.removeItem(SIM_HANDOFF_KEY);
      // Inject sim seats directly into context — no API call
      dispatch({ type: 'SET_SEATS', payload: simSeats });
      dispatch({ type: 'SET_STATS', payload: calculateFragmentationClient(simSeats) });
      dispatch({ type: 'SET_LOADING', payload: false });
      setSimMode(true);
      return;
    }

    // Priority 2: localStorage handoff (fallback for same-page navigation edge cases)
    try {
      const raw = localStorage.getItem(SIM_HANDOFF_KEY);
      if (raw) {
        const simSeats = JSON.parse(raw);
        localStorage.removeItem(SIM_HANDOFF_KEY);
        if (Array.isArray(simSeats) && simSeats.length > 50) {
          dispatch({ type: 'SET_SEATS', payload: simSeats });
          dispatch({ type: 'SET_STATS', payload: calculateFragmentationClient(simSeats) });
          dispatch({ type: 'SET_LOADING', payload: false });
          setSimMode(true);
          return;
        }
      }
    } catch { /* bad data */ }

    // Priority 3: Normal load from API / localStorage seat cache
    setSimMode(false);
    loadSeats();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user && !user.isGuest) {
      setForm(f => ({
        ...f,
        customerName:  f.customerName  || user.name  || '',
        customerEmail: f.customerEmail || user.email || '',
      }));
    }
  }, [user]);

  useEffect(() => {
    if (stats?.occupancyPct !== undefined) prevStatsRef.current = stats;
  }, [stats]);

  // Live auto-preview
  useEffect(() => {
    if (!seats.length || selectionMode === 'manual') return;
    const result = allocateSeatsClient(
      seats, parseInt(form.groupSize), form.wantsVip, form.needsAccessible
    );
    if (result.error) {
      setPreview([]); setPreviewScore(null); setPreviewNotes(result.message);
    } else {
      setPreview(result.seats); setPreviewScore(result.score); setPreviewNotes(result.notes);
    }
  }, [seats, form.groupSize, form.wantsVip, form.needsAccessible, selectionMode]);

  useEffect(() => {
    if (selectionMode === 'manual' && manualSeats.length > 0) {
      setForm(f => ({ ...f, groupSize: manualSeats.length }));
    }
  }, [manualSeats, selectionMode]);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    if (['groupSize','wantsVip','needsAccessible'].includes(name)) {
      setManualSeats([]); setSelectionMode('auto');
    }
  };

  const handleSeatClick = (seat) => {
    if (seat.status !== 'available') return;
    setSelectionMode('manual');
    setError('');
    setManualSeats(prev => {
      const already = prev.find(s => s.row === seat.row && s.number === seat.number);
      if (already) {
        const next = prev.filter(s => !(s.row === seat.row && s.number === seat.number));
        if (next.length === 0) setSelectionMode('auto');
        return next;
      }
      if (prev.length > 0 && prev[0].row !== seat.row) {
        setError('All seats must be in the same row. Deselect first.');
        return prev;
      }
      if (prev.length > 0) {
        const nums = prev.map(s => s.number).sort((a,b) => a-b);
        if (seat.number !== nums[0]-1 && seat.number !== nums[nums.length-1]+1) {
          setError('Seats must be consecutive. Select adjacent seats only.');
          return prev;
        }
      }
      if (prev.length >= 7) { setError('Maximum group size is 7.'); return prev; }
      return [...prev, seat];
    });
  };

  const clearManualSelection = () => { setManualSeats([]); setSelectionMode('auto'); setError(''); };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!form.customerName.trim())  return setError('Please enter your name.');
    if (!form.customerEmail.trim()) return setError('Please enter your email.');
    const finalGroupSize = selectionMode === 'manual' ? manualSeats.length : parseInt(form.groupSize);
    if (selectionMode === 'manual' && manualSeats.length === 0) return setError('Please click seats on the map.');
    if (selectionMode === 'manual') {
      const rows = [...new Set(manualSeats.map(s => s.row))];
      if (rows.length > 1) return setError('All seats must be in the same row.');
      const nums = manualSeats.map(s => s.number).sort((a,b)=>a-b);
      for (let i = 1; i < nums.length; i++)
        if (nums[i] !== nums[i-1]+1) return setError('Selected seats must be consecutive.');
    }
    setSubmitting(true);
    const bookingData = selectionMode === 'manual'
      ? { customerName: form.customerName, customerEmail: form.customerEmail,
          groupSize: finalGroupSize,
          wantsVip: manualSeats.some(s => s.type === 'vip'),
          needsAccessible: manualSeats.some(s => s.type === 'disability'),
          _manualSeats: manualSeats }
      : { ...form, groupSize: finalGroupSize };
    const result = await bookSeats(bookingData, user);
    setSubmitting(false);
    if (result.success) { setManualSeats([]); navigate('/confirmation'); }
    else setError(result.error || 'Booking failed. Please try again.');
  };

  const handleReset = () => {
    localStorage.removeItem(SIM_HANDOFF_KEY); // clear any leftover sim handoff
    clearSeatCache();
    setSimMode(false);
    setManualSeats([]);
    setSelectionMode('auto');
    resetLayout();
  };

  const availableCount = seats.filter(s => s.status === 'available' && s.type !== 'broken').length;
  const displayPreview = selectionMode === 'manual' ? manualSeats : preview;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Simulation mode banner */}
      {simMode && (
        <div className="mb-5 rounded-xl px-5 py-4 flex items-center justify-between gap-4"
             style={{ background:'rgba(239,68,68,0.08)', border:'2px solid rgba(239,68,68,0.4)' }}>
          <div>
            <div className="font-semibold text-sm mb-1" style={{ color:'#ef4444' }}>
              ⚠ Simulated Cinema Active
            </div>
            <p className="text-xs" style={{ color:'#94a3b8' }}>
              You are booking into a simulated crowded layout — not the real cinema.
              Book seats to observe how the algorithm performs under pressure.
              Click "Reset" to return to the live cinema.
            </p>
          </div>
          <button onClick={handleReset}
            className="px-4 py-2 rounded-lg text-xs font-semibold shrink-0"
            style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', color:'#fca5a5' }}>
            ✕ Exit Simulation
          </button>
        </div>
      )}

      <div className="mb-4">
        <h1 style={{ fontFamily:'"DM Serif Display",serif', fontSize:'2rem', color:'#f1f5f9' }}>
          Book Your Seats
        </h1>
        <p className="text-sm mt-1" style={{ color:'#64748b' }}>
          {selectionMode === 'manual'
            ? <span style={{ color:'#93c5fd' }}>Manual mode — click seats on the map. Click again to deselect.</span>
            : 'Auto mode — algorithm selects the best seats. Or click any seat to select manually.'}
          {user?.isGuest && (
            <span className="ml-2 px-2 py-0.5 rounded text-xs"
              style={{ background:'rgba(100,116,139,0.15)', color:'#94a3b8' }}>Guest</span>
          )}
        </p>
      </div>

      <div className="mb-5"><StatsBar stats={stats} /></div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => { setSelectionMode('auto'); setManualSeats([]); setError(''); }}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: selectionMode==='auto' ? 'rgba(232,184,75,0.1)' : '#1a1a26',
            border: `1px solid ${selectionMode==='auto' ? '#e8b84b' : '#2a2a3e'}`,
            color: selectionMode==='auto' ? '#e8b84b' : '#64748b',
          }}>🤖 Auto (Algorithm)</button>
        <button onClick={() => { setSelectionMode('manual'); setError(''); }}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: selectionMode==='manual' ? 'rgba(59,130,246,0.1)' : '#1a1a26',
            border: `1px solid ${selectionMode==='manual' ? '#3b82f6' : '#2a2a3e'}`,
            color: selectionMode==='manual' ? '#93c5fd' : '#64748b',
          }}>👆 Manual (Click Seats)</button>
        {selectionMode === 'manual' && manualSeats.length > 0 && (
          <button onClick={clearManualSelection}
            className="px-3 py-2 rounded-lg text-xs"
            style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#fca5a5' }}>
            ✕ Clear ({manualSeats.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl p-6" style={{ background:'#1a1a26', border:'1px solid #2a2a3e' }}>
            <h2 className="font-semibold mb-5" style={{ color:'#e8b84b' }}>Booking Details</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color:'#94a3b8' }}>Full Name</label>
                <input name="customerName" value={form.customerName} onChange={handleChange}
                  placeholder="John Smith" className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background:'#12121a', border:'1px solid #2a2a3e', color:'#f1f5f9' }} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color:'#94a3b8' }}>Email</label>
                <input name="customerEmail" type="email" value={form.customerEmail} onChange={handleChange}
                  placeholder="john@example.com" className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background:'#12121a', border:'1px solid #2a2a3e', color:'#f1f5f9' }} />
              </div>

              {selectionMode === 'auto' && (
                <>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color:'#94a3b8' }}>
                      Group Size: <span className="font-bold" style={{ color:'#e8b84b' }}>{form.groupSize}</span>
                      <span className="ml-1 text-xs" style={{ color:'#475569' }}>
                        {+form.groupSize===1?'(Solo)':+form.groupSize<=3?'(Small)':'(Group)'}
                      </span>
                    </label>
                    <input name="groupSize" type="range" min="1" max="7" value={form.groupSize}
                      onChange={handleChange} className="w-full accent-yellow-500" />
                    <div className="flex justify-between text-xs mt-1" style={{ color:'#475569' }}>
                      {[1,2,3,4,5,6,7].map(n=><span key={n}>{n}</span>)}
                    </div>
                  </div>
                  <div className="flex gap-5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input name="wantsVip" type="checkbox" checked={form.wantsVip} onChange={handleChange}
                        className="w-4 h-4 accent-yellow-500" />
                      <span className="text-sm" style={{ color:'#e8b84b' }}>VIP ★</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input name="needsAccessible" type="checkbox" checked={form.needsAccessible}
                        onChange={handleChange} className="w-4 h-4 accent-blue-500" />
                      <span className="text-sm" style={{ color:'#38bdf8' }}>♿ Accessible</span>
                    </label>
                  </div>
                </>
              )}

              {selectionMode === 'manual' && (
                <div className="rounded-lg p-3 text-xs"
                     style={{ background:'rgba(59,130,246,0.05)', border:'1px solid rgba(59,130,246,0.15)' }}>
                  <div className="font-semibold mb-1" style={{ color:'#93c5fd' }}>Manual Selection</div>
                  <div style={{ color:'#64748b' }}>
                    {manualSeats.length === 0
                      ? 'Click any blue seat on the cinema map.'
                      : `${manualSeats.length} seat${manualSeats.length!==1?'s':''} — Row ${manualSeats[0]?.row}, seats ${manualSeats.map(s=>s.number).sort((a,b)=>a-b).join(', ')}`}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg px-3 py-2.5"
                     style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)' }}>
                  <div className="text-xs font-semibold mb-0.5" style={{ color:'#fca5a5' }}>Notice</div>
                  <div className="text-xs" style={{ color:'#fca5a5' }}>{error}</div>
                </div>
              )}

              {!loading && availableCount < 15 && availableCount > 0 && (
                <div className="rounded-lg px-3 py-2 text-xs"
                     style={{ background:'rgba(232,184,75,0.08)', border:'1px solid rgba(232,184,75,0.2)', color:'#e8b84b' }}>
                  ⚠ Only {availableCount} seats remain
                </div>
              )}

              <button type="submit"
                disabled={submitting || loading || (selectionMode==='auto' ? preview.length===0 : manualSeats.length===0)}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: (selectionMode==='auto' ? preview.length>0 : manualSeats.length>0)
                    ? 'linear-gradient(135deg,#e8b84b,#c89530)' : '#2a2a3e',
                  color: (selectionMode==='auto' ? preview.length>0 : manualSeats.length>0) ? '#0a0a0f' : '#475569',
                  opacity: submitting ? 0.7 : 1,
                }}>
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Booking…
                  </span>
                ) : loading ? 'Loading seats…'
                  : selectionMode === 'manual'
                    ? manualSeats.length > 0
                      ? `Confirm ${manualSeats.length} Seat${manualSeats.length!==1?'s':''} (Manual)`
                      : 'Click seats on map to select'
                    : preview.length > 0
                      ? `Confirm ${form.groupSize} Seat${+form.groupSize>1?'s':''}`
                      : 'Finding seats…'}
              </button>
            </form>

            <div className="mt-3 flex gap-2">
              <button onClick={handleReset} disabled={loading}
                className="flex-1 py-2 rounded-lg text-xs"
                style={{ background:'#12121a', border:'1px solid #2a2a3e', color:'#64748b' }}>
                {simMode ? '✕ Exit Simulation' : '↺ Reset Layout'}
              </button>
              <button onClick={handleReset} disabled={loading}
                className="px-3 py-2 rounded-lg text-xs"
                style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#fca5a5' }}>
                🗑 Clear Cache
              </button>
            </div>
          </div>

          {selectionMode === 'auto' && preview.length > 0 && (
            <AlgorithmPanel preview={preview} score={previewScore}
              notes={previewNotes} groupSize={+form.groupSize}
              stats={stats} prevStats={prevStatsRef.current} />
          )}
          {selectionMode === 'auto' && !preview.length && previewNotes && (
            <div className="rounded-xl px-4 py-3 text-xs"
                 style={{ background:'rgba(232,184,75,0.05)', border:'1px solid rgba(232,184,75,0.15)', color:'#94a3b8' }}>
              <div className="font-semibold mb-1" style={{ color:'#e8b84b' }}>Algorithm Note</div>
              {previewNotes}
            </div>
          )}
          {selectionMode === 'manual' && (
            <div className="rounded-xl px-4 py-3 text-xs"
                 style={{ background:'rgba(59,130,246,0.05)', border:'1px solid rgba(59,130,246,0.15)', color:'#64748b' }}>
              💡 Click any blue seat to select. Seats must be consecutive in the same row (max 7).
            </div>
          )}
        </div>

        {/* Seat Grid */}
        <div className="lg:col-span-2">
          <div className="rounded-xl p-5" style={{ background:'#1a1a26', border:'1px solid #2a2a3e' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold" style={{ color:'#e8b84b' }}>
                {simMode ? '⚠ Simulated Cinema Layout' : 'Cinema Layout'}
              </h2>
              <span className="text-xs" style={{ color:'#64748b' }}>
                {loading ? <span style={{ color:'#e8b84b' }}>Loading…</span>
                  : <>{availableCount} available
                    {displayPreview.length > 0 &&
                      <span className="ml-2" style={{ color: selectionMode==='manual'?'#3b82f6':'#22c55e' }}>
                        · {displayPreview.length} {selectionMode==='manual'?'selected':'highlighted'}
                      </span>}
                  </>}
              </span>
            </div>
            {loading
              ? <div className="flex flex-col items-center justify-center h-64 gap-3">
                  <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm" style={{ color:'#64748b' }}>Loading cinema layout…</span>
                </div>
              : <SeatGrid seats={seats} highlightedSeats={displayPreview} onSeatClick={handleSeatClick} />}
          </div>
        </div>
      </div>
    </div>
  );
}
