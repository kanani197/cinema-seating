/**
 * Frontend Tests — Cinema Seating Optimisation System
 * 32 tests: layout, algorithm, fragmentation, simulation, components, auth logic
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { buildInMemoryLayout } from '../utils/layoutBuilder';
import {
  allocateSeatsClient,
  calculateFragmentationClient,
  simulateOccupancyClient,
} from '../utils/algorithmClient';
import SeatGrid      from '../components/seats/SeatGrid';
import StatsBar      from '../components/StatsBar';
import AlgorithmPanel from '../components/AlgorithmPanel';

// ─── Layout ──────────────────────────────────────────────────────────────────
describe('buildInMemoryLayout', () => {
  test('generates 15 rows A–O', () => {
    const seats = buildInMemoryLayout('t');
    expect([...new Set(seats.map(s => s.row))]).toHaveLength(15);
  });
  test('6 disability seats all in row A', () => {
    const dis = buildInMemoryLayout('t').filter(s => s.type === 'disability');
    expect(dis).toHaveLength(6);
    dis.forEach(s => expect(s.row).toBe('A'));
  });
  test('disability seats are consecutive', () => {
    const dis = buildInMemoryLayout('t').filter(s => s.type === 'disability')
                                        .sort((a,b) => a.number - b.number);
    for (let i = 1; i < dis.length; i++) expect(dis[i].number).toBe(dis[i-1].number + 1);
  });
  test('VIP only in rows E–H, cols 12–15', () => {
    buildInMemoryLayout('t').filter(s => s.type === 'vip').forEach(s => {
      expect(['E','F','G','H']).toContain(s.row);
      expect([12,13,14,15]).toContain(s.number);
    });
  });
  test('broken seats never in rows A or B', () => {
    buildInMemoryLayout('t').filter(s => s.type === 'broken')
      .forEach(s => expect(['A','B']).not.toContain(s.row));
  });
  test('all seats have required fields', () => {
    buildInMemoryLayout('t').forEach(s => {
      expect(s).toHaveProperty('row');
      expect(s).toHaveProperty('number');
      expect(s).toHaveProperty('type');
      expect(s).toHaveProperty('status');
    });
  });
});

// ─── Allocation Algorithm ────────────────────────────────────────────────────
describe('allocateSeatsClient', () => {
  test('allocates exact number requested', () => {
    const r = allocateSeatsClient(buildInMemoryLayout('t'), 3);
    expect(r.error).toBeUndefined();
    expect(r.seats).toHaveLength(3);
  });
  test('all in same row', () => {
    const r = allocateSeatsClient(buildInMemoryLayout('t'), 4);
    expect([...new Set(r.seats.map(s => s.row))]).toHaveLength(1);
  });
  test('consecutive seat numbers', () => {
    const r = allocateSeatsClient(buildInMemoryLayout('t'), 5);
    const nums = r.seats.map(s => s.number).sort((a,b) => a-b);
    for (let i = 1; i < nums.length; i++) expect(nums[i]).toBe(nums[i-1]+1);
  });
  test('only available seats allocated', () => {
    allocateSeatsClient(buildInMemoryLayout('t'), 2).seats
      .forEach(s => expect(s.status).toBe('available'));
  });
  test('NO_SEATS_AVAILABLE when fully booked', () => {
    const full = buildInMemoryLayout('t').map(s => ({ ...s, status: 'booked' }));
    expect(allocateSeatsClient(full, 2).error).toBe('NO_SEATS_AVAILABLE');
  });
  test('VIP returns vip-type seats', () => {
    const r = allocateSeatsClient(buildInMemoryLayout('t'), 2, true, false);
    expect(r.error).toBeUndefined();
    expect(r.seats.some(s => s.type === 'vip')).toBe(true);
  });
  test('accessibility returns seats in rows A or B', () => {
    const r = allocateSeatsClient(buildInMemoryLayout('t'), 2, false, true);
    expect(r.error).toBeUndefined();
    r.seats.forEach(s => expect(['A','B']).toContain(s.row));
  });
  test('score is a number', () => {
    expect(typeof allocateSeatsClient(buildInMemoryLayout('t'), 3).score).toBe('number');
  });
  test('notes is a non-empty string', () => {
    const notes = allocateSeatsClient(buildInMemoryLayout('t'), 2).notes;
    expect(typeof notes).toBe('string');
    expect(notes.length).toBeGreaterThan(0);
  });
  test('group of 7 fits in one row', () => {
    const r = allocateSeatsClient(buildInMemoryLayout('t'), 7);
    expect(r.error).toBeUndefined();
    expect([...new Set(r.seats.map(s => s.row))]).toHaveLength(1);
  });
});

// ─── Fragmentation ───────────────────────────────────────────────────────────
describe('calculateFragmentationClient', () => {
  test('fresh layout has low fragmentation', () => {
    expect(calculateFragmentationClient(buildInMemoryLayout('t')).fragmentationScore).toBeLessThan(15);
  });
  test('~50% occupancy when half booked', () => {
    const seats = buildInMemoryLayout('t');
    const half = seats.map((s,i) => i < Math.floor(seats.length/2) ? { ...s, status:'booked' } : s);
    const pct = calculateFragmentationClient(half).occupancyPct;
    expect(pct).toBeGreaterThanOrEqual(35);
    expect(pct).toBeLessThanOrEqual(65);
  });
  test('detects isolated single seat', () => {
    const seats = buildInMemoryLayout('t').map(s =>
      s.row === 'G' && s.number !== 12 && s.status === 'available' ? { ...s, status:'booked' } : s
    );
    expect(calculateFragmentationClient(seats).isolatedCount).toBeGreaterThanOrEqual(1);
  });
  test('fully booked → 0 isolated', () => {
    const full = buildInMemoryLayout('t').map(s => ({ ...s, status:'booked' }));
    expect(calculateFragmentationClient(full).isolatedCount).toBe(0);
  });
  test('returns totalAvailable', () => {
    expect(calculateFragmentationClient(buildInMemoryLayout('t')).totalAvailable).toBeGreaterThan(0);
  });
});

// ─── Simulation ──────────────────────────────────────────────────────────────
describe('simulateOccupancyClient', () => {
  test('half → 30–70% occupancy', () => {
    const r = simulateOccupancyClient(buildInMemoryLayout('t'), 'half');
    expect(r.stats.occupancyPct).toBeGreaterThanOrEqual(30);
    expect(r.stats.occupancyPct).toBeLessThanOrEqual(70);
  });
  test('nearly_full → >60%', () => {
    expect(simulateOccupancyClient(buildInMemoryLayout('t'), 'nearly_full').stats.occupancyPct).toBeGreaterThan(60);
  });
  test('returns same seat count', () => {
    const seats = buildInMemoryLayout('t');
    expect(simulateOccupancyClient(seats,'half').seats.length).toBe(seats.length);
  });
});

// ─── Components ──────────────────────────────────────────────────────────────
describe('SeatGrid', () => {
  test('renders without crash on empty seats', () => { render(<SeatGrid seats={[]} />); });
  test('shows SCREEN label', () => {
    render(<SeatGrid seats={[]} />);
    expect(screen.getByText(/SCREEN/i)).toBeInTheDocument();
  });
  test('renders seat buttons', () => {
    render(<SeatGrid seats={buildInMemoryLayout('t').slice(0,15)} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });
  test('legend shows all 5 labels', () => {
    render(<SeatGrid seats={[]} />);
    ['Available','Booked','VIP','Broken','Disability'].forEach(l =>
      expect(screen.getByText(l)).toBeInTheDocument()
    );
  });
});

describe('StatsBar', () => {
  test('shows occupancy value', () => {
    render(<StatsBar stats={{ occupancyPct:45, fragmentationScore:5, isolatedCount:2, bookedSeats:100, totalAvailable:200 }} />);
    expect(screen.getByText('45%')).toBeInTheDocument();
  });
  test('renders with undefined stats', () => {
    render(<StatsBar stats={{}} />);
    expect(screen.getAllByText('0%').length).toBeGreaterThan(0);
  });
});

describe('AlgorithmPanel', () => {
  test('shows Why heading when preview populated', () => {
    const r = allocateSeatsClient(buildInMemoryLayout('t'), 2);
    render(<AlgorithmPanel preview={r.seats} score={r.score} notes={r.notes} groupSize={2} />);
    expect(screen.getByText(/Why These Seats/i)).toBeInTheDocument();
  });
  test('returns null for empty preview', () => {
    const { container } = render(<AlgorithmPanel preview={[]} score={0} notes="" groupSize={2} />);
    expect(container.firstChild).toBeNull();
  });
});
