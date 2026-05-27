import React, { useMemo, useState } from 'react';

const ROWS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O'];

function getSeatStyle(seat, isHighlighted) {
  if (isHighlighted) return {
    background: 'linear-gradient(135deg,#22c55e,#16a34a)',
    border: '2px solid #4ade80',
    boxShadow: '0 0 10px rgba(34,197,94,0.6)',
    cursor: 'default',
  };
  if (seat.type === 'broken' || seat.status === 'broken') return {
    background: '#1f2937', border: '1px solid #374151',
    cursor: 'not-allowed', opacity: 0.5,
  };
  if (seat.status === 'booked') return {
    background: 'linear-gradient(135deg,#b91c1c,#dc2626)',
    border: '1px solid #ef4444', cursor: 'not-allowed', opacity: 0.9,
  };
  if (seat.type === 'vip') return {
    background: 'linear-gradient(135deg,#92400e,#b45309)',
    border: '1px solid #e8b84b', cursor: 'pointer',
  };
  if (seat.type === 'disability') return {
    background: 'linear-gradient(135deg,#075985,#0369a1)',
    border: '1px solid #38bdf8', cursor: 'pointer',
  };
  return {
    background: 'linear-gradient(135deg,#1e3a5f,#1e40af)',
    border: '1px solid #3b82f6', cursor: 'pointer',
  };
}

function getSeatTooltip(seat, isHighlighted) {
  if (isHighlighted) return `${seat.row}${seat.number} — Selected ✓`;
  if (seat.type === 'broken' || seat.status === 'broken') return `${seat.row}${seat.number} — Broken (out of service)`;
  if (seat.status === 'booked') return `${seat.row}${seat.number} — Booked`;
  if (seat.type === 'vip') return `${seat.row}${seat.number} — VIP ★`;
  if (seat.type === 'disability') return `${seat.row}${seat.number} — Accessible ♿`;
  return `${seat.row}${seat.number} — Available`;
}

function Seat({ seat, isHighlighted, onClick }) {
  const [hover, setHover] = useState(false);
  const style = getSeatStyle(seat, isHighlighted);
  const canClick = seat.status === 'available' && !isHighlighted
    && seat.type !== 'broken' && seat.status !== 'broken';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="seat-btn rounded-sm flex items-center justify-center transition-transform"
        style={{ width: 18, height: 16, fontSize: 7, color: 'rgba(255,255,255,0.85)',
                 borderRadius: 3, ...style,
                 transform: hover && canClick ? 'scale(1.25)' : isHighlighted ? 'scale(1.15)' : 'scale(1)',
                 zIndex: hover ? 10 : 1, position: 'relative' }}
        title={getSeatTooltip(seat, isHighlighted)}
        disabled={!canClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => canClick && onClick && onClick(seat)}>
        {seat.number}
      </button>
      {/* Tooltip */}
      {hover && (
        <div style={{
          position: 'absolute', bottom: '120%', left: '50%',
          transform: 'translateX(-50%)', zIndex: 50,
          background: '#0a0a0f', border: '1px solid #2a2a3e',
          borderRadius: 6, padding: '4px 8px', whiteSpace: 'nowrap',
          fontSize: 10, color: '#f1f5f9', pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          {getSeatTooltip(seat, isHighlighted)}
        </div>
      )}
    </div>
  );
}

function groupByRow(seats) {
  const map = {};
  for (const seat of seats) {
    if (!map[seat.row]) map[seat.row] = [];
    map[seat.row].push(seat);
  }
  for (const row of Object.keys(map)) map[row].sort((a, b) => a.number - b.number);
  return map;
}

export default function SeatGrid({ seats = [], highlightedSeats = [], onSeatClick }) {
  const byRow = useMemo(() => groupByRow(seats), [seats]);
  const highlightedIds = useMemo(
    () => new Set(highlightedSeats.map(s => `${s.row}_${s.number}`)),
    [highlightedSeats]
  );

  // Stats for mini legend
  const available  = seats.filter(s => s.status === 'available' && s.type !== 'broken').length;
  const booked     = seats.filter(s => s.status === 'booked').length;
  const broken     = seats.filter(s => s.type === 'broken').length;

  return (
    <div className="w-full overflow-x-auto">
      {/* Screen */}
      <div className="mb-5 flex justify-center">
        <div className="screen-glow rounded-lg flex items-center justify-center"
             style={{ width: '55%', height: 30,
                      background: 'linear-gradient(90deg,#1e3a5f,#2563eb,#1e3a5f)',
                      color: '#93c5fd', fontSize: 12, fontWeight: 700,
                      letterSpacing: '0.15em', border: '1px solid #3b82f6' }}>
          ◀ SCREEN ▶
        </div>
      </div>

      {/* Seat grid */}
      <div className="flex flex-col gap-[3px]">
        {ROWS.map(row => {
          const rowSeats = byRow[row] || [];
          if (rowSeats.length === 0) return null;
          return (
            <div key={row} className="flex items-center gap-[1px]">
              <span className="text-xs font-mono w-5 text-right mr-1.5 shrink-0"
                    style={{ color: '#475569' }}>{row}</span>
              <div className="flex items-center gap-[2px] flex-wrap">
                {rowSeats.map((seat, idx) => {
                  const prev = rowSeats[idx - 1];
                  const gap  = prev && seat.number > prev.number + 1;
                  return (
                    <React.Fragment key={`${seat.row}_${seat.number}`}>
                      {gap && <div style={{ width: seat.number - prev.number > 3 ? 14 : 5 }} />}
                      <Seat
                        seat={seat}
                        isHighlighted={highlightedIds.has(`${seat.row}_${seat.number}`)}
                        onClick={onSeatClick} />
                    </React.Fragment>
                  );
                })}
              </div>
              <span className="text-xs font-mono ml-1.5 shrink-0"
                    style={{ color: '#475569' }}>{row}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap gap-3 justify-center items-center">
        {[
          { bg: 'linear-gradient(135deg,#1e3a5f,#1e40af)', bd: '#3b82f6', label: 'Available', count: available },
          { bg: 'linear-gradient(135deg,#b91c1c,#dc2626)',  bd: '#ef4444', label: 'Booked',    count: booked },
          { bg: 'linear-gradient(135deg,#92400e,#b45309)',  bd: '#e8b84b', label: 'VIP' },
          { bg: 'linear-gradient(135deg,#075985,#0369a1)',  bd: '#38bdf8', label: 'Disability' },
          { bg: '#1f2937', bd: '#374151', label: 'Broken', count: broken },
          { bg: 'linear-gradient(135deg,#22c55e,#16a34a)',  bd: '#4ade80', label: 'Selected' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="rounded-sm shrink-0"
                 style={{ width: 13, height: 11, background: item.bg, border: `1px solid ${item.bd}` }} />
            <span className="text-xs" style={{ color: '#64748b' }}>
              {item.label}
              {item.count !== undefined && (
                <span className="ml-1 font-mono" style={{ color: '#475569' }}>({item.count})</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
