import React from 'react';

/**
 * RejectionModal
 *
 * Shown when the algorithm rejects a booking because it would create
 * isolated single-seat gaps (orphan seats).
 *
 * Displays:
 * - Why the booking was rejected
 * - Which specific seats would be orphaned
 * - Alternative suggestions from the algorithm
 */
export default function RejectionModal({ rejection, groupSize, onClose, onUseAlternative }) {
  if (!rejection) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
         style={{ background: 'rgba(0,0,0,0.75)' }}
         onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6"
           style={{ background: '#1a1a26', border: '1px solid rgba(239,68,68,0.4)' }}
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="text-2xl">🚫</div>
          <div>
            <h3 className="font-bold mb-1" style={{ color: '#ef4444', fontSize: '1rem' }}>
              Booking Rejected
            </h3>
            <p className="text-sm" style={{ color: '#94a3b8', lineHeight: 1.6 }}>
              {rejection.reason}
            </p>
          </div>
        </div>

        {/* Detail */}
        {rejection.detail && (
          <div className="rounded-xl p-4 mb-4"
               style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <div className="text-xs font-semibold mb-2" style={{ color: '#ef4444' }}>
              Isolation Analysis
            </div>
            <p className="text-xs" style={{ color: '#94a3b8', lineHeight: 1.6 }}>
              {rejection.detail}
            </p>
            {rejection.orphansWouldCreate > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
                   style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
                ⚠ Would create {rejection.orphansWouldCreate} orphaned seat{rejection.orphansWouldCreate > 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {/* Visual example */}
        <div className="rounded-xl p-4 mb-4"
             style={{ background: '#12121a', border: '1px solid #2a2a3e' }}>
          <div className="text-xs mb-2" style={{ color: '#64748b' }}>What we prevent:</div>
          <div className="flex items-center gap-1 mb-1">
            {['X','X','_','O','X','X'].map((s, i) => (
              <div key={i} className="w-7 h-6 rounded text-xs flex items-center justify-center font-mono font-bold"
                   style={{
                     background: s === 'X' ? '#dc2626' : s === '_' ? 'rgba(239,68,68,0.15)' : '#374151',
                     border: s === '_' ? '2px solid #ef4444' : '1px solid transparent',
                     color: s === '_' ? '#ef4444' : 'white',
                     animation: s === '_' ? 'pulse 1.5s infinite' : 'none'
                   }}>
                {s}
              </div>
            ))}
            <span className="text-xs ml-2" style={{ color: '#ef4444' }}>← orphan gap ❌</span>
          </div>
          <div className="flex items-center gap-1">
            {['X','X','X','O','O','X'].map((s, i) => (
              <div key={i} className="w-7 h-6 rounded text-xs flex items-center justify-center font-mono font-bold"
                   style={{
                     background: s === 'X' ? '#dc2626' : '#1e40af',
                     color: 'white',
                   }}>
                {s}
              </div>
            ))}
            <span className="text-xs ml-2" style={{ color: '#22c55e' }}>← optimised ✓</span>
          </div>
        </div>

        {/* Alternative suggestions */}
        {rejection.alternatives && rejection.alternatives.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold mb-2" style={{ color: '#e8b84b' }}>
              Algorithm Suggestions
            </div>
            <div className="space-y-2">
              {rejection.alternatives.map((alt, idx) => (
                <button key={idx}
                  onClick={() => onUseAlternative && onUseAlternative(alt)}
                  className="w-full text-left rounded-xl p-3 transition-all"
                  style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: '#22c55e' }}>
                      Book {alt.groupSize} seat{alt.groupSize > 1 ? 's' : ''} instead
                    </span>
                    <span className="text-xs font-mono" style={{ color: '#e8b84b' }}>
                      Score: {alt.score?.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#64748b' }}>
                    Row {alt.row} · Seats {alt.seats?.join(', ')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={onClose}
          className="w-full py-3 rounded-xl font-semibold text-sm"
          style={{ background: '#2a2a3e', color: '#94a3b8' }}>
          Close
        </button>
      </div>
    </div>
  );
}
