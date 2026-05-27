import React, { useState } from 'react';

const ROW_TIER = { A:4,B:4,C:3,D:3,E:2,F:2,G:1,H:1,I:1,J:1,K:2,L:2,M:3,N:3,O:4 };
const TIER_LABELS = { 1:'Tier 1 – Optimal viewing', 2:'Tier 2 – Good viewing', 3:'Tier 3 – Acceptable', 4:'Tier 4 – Front/back row' };
const TIER_COLORS = { 1:'#22c55e', 2:'#86efac', 3:'#e8b84b', 4:'#ef4444' };

export default function AlgorithmPanel({ preview, score, notes, groupSize, stats, prevStats }) {
  const [expanded, setExpanded] = useState(true);
  if (!preview || preview.length === 0) return null;

  const row   = preview[0]?.row;
  const cols  = preview.map(s => s.number);
  const tier  = ROW_TIER[row] || 4;

  const centreCount = cols.filter(c => c >= 10 && c <= 18).length;
  const centreRatio = ((centreCount / cols.length) * 100).toFixed(0);
  const orphanScore = score < 0 ? score : 0;
  const hasOrphan   = orphanScore < -5;

  // Fragmentation delta (if prevStats provided)
  const fragDelta = prevStats && stats
    ? stats.fragmentationScore - prevStats.fragmentationScore
    : null;

  const breakdown = [
    {
      label: 'Group kept together',
      detail: `All ${groupSize} seat${groupSize>1?'s':''} in row ${row} — no splitting`,
      value: preview.length === groupSize ? '+10' : '+0',
      ok: preview.length === groupSize,
    },
    {
      label: `Centre alignment — ${centreRatio}%`,
      detail: centreCount === cols.length
        ? 'Fully centred (cols 10–18) — best viewing angle'
        : centreCount > 0 ? 'Partially centred'
        : 'Edge/side seats selected',
      value: `+${(centreCount / cols.length * 8).toFixed(1)}`,
      ok: centreCount > 0,
    },
    {
      label: TIER_LABELS[tier],
      detail: tier === 1
        ? 'Rows G–J — optimal distance from screen'
        : tier === 2 ? 'Rows E–F or K–L — good viewing'
        : tier === 3 ? 'Rows C–D or M–N — acceptable'
        : 'Front or back rows — less preferred',
      value: `+${(5 - tier) * 2}`,
      ok: tier <= 2,
      color: TIER_COLORS[tier],
    },
    {
      label: hasOrphan ? 'Some fragmentation unavoidable' : 'No orphan gaps created',
      detail: hasOrphan
        ? 'Best available option chosen — orphan gap unavoidable at current occupancy'
        : 'Booking leaves no isolated single seats — optimal layout preserved',
      value: hasOrphan ? `${orphanScore.toFixed(0)}` : '+5',
      ok: !hasOrphan,
    },
    {
      label: groupSize === 1 ? 'Solo edge preference applied' : 'Group centre preference applied',
      detail: groupSize === 1
        ? 'Solo bookers prefer edge/aisle seats — prime centre seats preserved for groups'
        : 'Groups placed centre to maximise satisfaction and minimise fragmentation',
      value: groupSize === 1 ? '+5' : '+0',
      ok: true,
    },
  ];

  return (
    <div className="rounded-xl overflow-hidden"
         style={{ border: '1px solid rgba(232,184,75,0.2)', background: 'rgba(232,184,75,0.02)' }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(232,184,75,0.06)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#e8b84b' }}>
            Why These Seats?
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                style={{ background: 'rgba(232,184,75,0.1)', color: '#e8b84b' }}>
            Score: {score?.toFixed(1)}
          </span>
        </div>
        <span style={{ color: '#64748b' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-3">
          {/* Selected seats */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {preview.map(s => (
              <div key={`${s.row}${s.number}`}
                   className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold"
                   style={{
                     background: s.type === 'vip' ? 'rgba(232,184,75,0.15)'
                       : s.type === 'disability' ? 'rgba(56,189,248,0.15)'
                       : 'rgba(34,197,94,0.15)',
                     border: `1px solid ${s.type === 'vip' ? '#e8b84b' : s.type === 'disability' ? '#38bdf8' : '#22c55e'}`,
                     color:  s.type === 'vip' ? '#e8b84b' : s.type === 'disability' ? '#38bdf8' : '#22c55e',
                   }}>
                {s.row}{s.number}
                {s.type === 'vip' && ' ★'}
                {s.type === 'disability' && ' ♿'}
              </div>
            ))}
          </div>

          {/* Score breakdown */}
          <div className="space-y-2 mb-3">
            {breakdown.map(item => (
              <div key={item.label} className="rounded-lg p-2.5"
                   style={{ background: 'rgba(0,0,0,0.2)' }}>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span style={{ color: item.ok ? '#22c55e' : '#ef4444' }}>
                      {item.ok ? '✓' : '⚠'}
                    </span>
                    <span className="font-medium" style={{ color: item.color || '#f1f5f9' }}>
                      {item.label}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold"
                        style={{ color: item.ok ? '#22c55e' : '#e8b84b' }}>
                    {item.value}
                  </span>
                </div>
                <p className="text-xs ml-4" style={{ color: '#64748b' }}>{item.detail}</p>
              </div>
            ))}
          </div>

          {/* Fragmentation delta */}
          {fragDelta !== null && (
            <div className="rounded-lg p-2.5 mb-3"
                 style={{ background: fragDelta <= 0 ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                          border: `1px solid ${fragDelta <= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
              <div className="text-xs font-semibold mb-0.5"
                   style={{ color: fragDelta <= 0 ? '#22c55e' : '#e8b84b' }}>
                {fragDelta <= 0 ? '✓ Fragmentation reduced' : '⚠ Minor fragmentation increase'}
              </div>
              <p className="text-xs" style={{ color: '#64748b' }}>
                Fragmentation score {fragDelta <= 0 ? 'decreased' : 'increased'} by{' '}
                {Math.abs(fragDelta).toFixed(0)}% — {fragDelta <= 0
                  ? 'booking improves overall layout efficiency'
                  : 'unavoidable at current occupancy level'}
              </p>
            </div>
          )}

          {/* Summary note */}
          <div className="text-xs pt-2" style={{ color: '#64748b', borderTop: '1px solid #2a2a3e' }}>
            {notes}
          </div>
        </div>
      )}
    </div>
  );
}
