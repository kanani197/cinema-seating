import React from 'react';

export default function StatsBar({ stats }) {
  const {
    occupancyPct      = 0,
    fragmentationScore = 0,
    isolatedCount     = 0,
    bookedSeats       = 0,
    totalAvailable    = 0,
  } = stats || {};

  const items = [
    {
      label: 'Occupancy',
      value: `${occupancyPct}%`,
      sub:   `${bookedSeats} seats booked`,
      color: occupancyPct > 80 ? '#ef4444' : occupancyPct > 50 ? '#e8b84b' : '#22c55e',
      bar:   occupancyPct,
      barColor: occupancyPct > 80 ? '#ef4444' : occupancyPct > 50 ? '#e8b84b' : '#22c55e',
      icon:  '🎭',
    },
    {
      label: 'Fragmentation',
      value: `${fragmentationScore}%`,
      sub:   'Isolated seat ratio',
      color: fragmentationScore > 20 ? '#ef4444' : fragmentationScore > 8 ? '#e8b84b' : '#22c55e',
      bar:   Math.min(fragmentationScore, 100),
      barColor: fragmentationScore > 20 ? '#ef4444' : fragmentationScore > 8 ? '#e8b84b' : '#22c55e',
      icon:  '📊',
    },
    {
      label: 'Isolated Gaps',
      value: isolatedCount,
      sub:   'Single orphaned seats',
      color: isolatedCount > 5 ? '#ef4444' : isolatedCount > 2 ? '#e8b84b' : '#22c55e',
      bar:   null,
      icon:  '🚫',
    },
    {
      label: 'Available',
      value: totalAvailable,
      sub:   'Seats remaining',
      color: '#3b82f6',
      bar:   null,
      icon:  '💺',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(item => (
        <div key={item.label} className="rounded-xl p-4 card-hover"
             style={{ background: '#1a1a26', border: '1px solid #2a2a3e' }}>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs" style={{ color: '#64748b' }}>{item.label}</div>
            <span className="text-base">{item.icon}</span>
          </div>
          <div className="text-2xl font-bold font-mono mb-1" style={{ color: item.color }}>
            {item.value}
          </div>
          <div className="text-xs mb-2" style={{ color: '#475569' }}>{item.sub}</div>
          {item.bar !== null && (
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#2a2a3e' }}>
              <div className="h-full rounded-full transition-all duration-500"
                   style={{ width: `${Math.min(item.bar, 100)}%`, background: item.barColor }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
