import React, { createContext, useContext, useReducer, useCallback } from 'react';
import axios from 'axios';
import { buildInMemoryLayout } from '../utils/layoutBuilder';
import { allocateSeatsClient, calculateFragmentationClient } from '../utils/algorithmClient';

const CinemaContext = createContext(null);

const initialState = {
  seats: [], loading: false, error: null,
  stats: { occupancyPct: 0, fragmentationScore: 0, isolatedCount: 0 },
  lastBooking: null, sessionId: 'default',
};

function cinemaReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':      return { ...state, loading: action.payload, error: null };
    case 'SET_ERROR':        return { ...state, error: action.payload, loading: false };
    case 'SET_SEATS':        return { ...state, seats: action.payload, loading: false };
    case 'SET_STATS':        return { ...state, stats: action.payload };
    case 'SET_LAST_BOOKING': return { ...state, lastBooking: action.payload };
    case 'CLEAR_ERROR':      return { ...state, error: null };
    default: return state;
  }
}

// ─── localStorage helpers ────────────────────────────────────────────────────
const BOOKINGS_KEY = 'cinema_bookings';
const SEAT_KEY     = 'cinema_seats_default';

export function saveBookingLocally(booking) {
  try {
    const stored = JSON.parse(localStorage.getItem(BOOKINGS_KEY) || '[]');
    if (!stored.find(b => b.bookingRef === booking.bookingRef)) {
      stored.unshift({ ...booking, createdAt: booking.createdAt || new Date().toISOString() });
      localStorage.setItem(BOOKINGS_KEY, JSON.stringify(stored.slice(0, 200)));
    }
  } catch { /* ignore */ }
}

export function cancelBookingLocally(bookingRef) {
  try {
    const stored = JSON.parse(localStorage.getItem(BOOKINGS_KEY) || '[]');
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(
      stored.map(b => b.bookingRef === bookingRef ? { ...b, status: 'cancelled' } : b)
    ));
  } catch { /* ignore */ }
}

export function getLocalBookings(filterEmail = null, guestId = null) {
  try {
    const stored = JSON.parse(localStorage.getItem(BOOKINGS_KEY) || '[]');
    if (!filterEmail && !guestId) return stored;
    if (guestId) return stored.filter(b => b.guestId === guestId);
    return stored.filter(b => b.customerEmail?.toLowerCase() === filterEmail?.toLowerCase());
  } catch { return []; }
}

function loadValidSeatCache() {
  try {
    const raw = localStorage.getItem(SEAT_KEY);
    if (!raw) return null;
    const seats = JSON.parse(raw);
    if (!Array.isArray(seats) || seats.length < 100) return null;
    const booked = seats.filter(s => s.status === 'booked').length;
    if (booked / seats.length > 0.8) return null;
    if (!seats[0]?.row || seats[0]?.number === undefined) return null;
    return seats;
  } catch { return null; }
}

function cacheSeatState(seats) {
  try { localStorage.setItem(SEAT_KEY, JSON.stringify(seats)); } catch { /* ignore */ }
}

export function clearSeatCache() {
  Object.keys(localStorage)
    .filter(k => k.startsWith('cinema_seats'))
    .forEach(k => localStorage.removeItem(k));
}

/** Check if backend is reachable */
async function isBackendReachable() {
  try {
    await axios.get('/api/health', { timeout: 2000 });
    return true;
  } catch { return false; }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function CinemaProvider({ children }) {
  const [state, dispatch] = useReducer(cinemaReducer, initialState);

  const loadSeats = useCallback(async (sessionId = 'default', skipApi = false) => {
    dispatch({ type: 'SET_LOADING', payload: true });

    if (!skipApi) {
      try {
        const { data } = await axios.get(`/api/seats?sessionId=${sessionId}`, { timeout: 4000 });
        dispatch({ type: 'SET_SEATS', payload: data.seats });
        dispatch({ type: 'SET_STATS', payload: data.stats });
        cacheSeatState(data.seats);
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      } catch { /* fall through to localStorage */ }
    }

    // Offline or skipApi=true: use localStorage cache or build fresh
    const cached = loadValidSeatCache();
    const seats  = cached || buildInMemoryLayout(sessionId);
    if (!cached) cacheSeatState(seats);
    dispatch({ type: 'SET_SEATS', payload: seats });
    dispatch({ type: 'SET_STATS', payload: calculateFragmentationClient(seats) });
    dispatch({ type: 'SET_LOADING', payload: false });
  }, []);

  /**
   * bookSeats
   *
   * Strategy:
   * 1. Always try the backend first.
   * 2. If backend returns 2xx → save to MongoDB and localStorage, done.
   * 3. If backend is reachable but returns an error (4xx/5xx) → surface that error.
   * 4. If backend is unreachable (network error) → run full client-side fallback.
   * 
   * This ensures MongoDB gets the booking when the backend is running.
   */
  const bookSeats = useCallback(async (bookingData, user = null) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });

    const guestId  = user?.isGuest ? user.guestId : null;
    const userType = user?.isGuest ? 'guest' : (user?.role || 'customer');

    // ── 1. Try backend ────────────────────────────────────────────────────────
    let backendReachable = false;
    try {
      const { data } = await axios.post('/api/bookings/book', {
        ...bookingData,
        sessionId: state.sessionId,
        guestId,
        userType,
      }, { timeout: 6000 });

      // ✅ Backend succeeded — booking is in MongoDB
      backendReachable = true;
      saveBookingLocally({ ...data.booking, guestId });
      dispatch({ type: 'SET_LAST_BOOKING', payload: data });

      // Refresh seat state from backend
      try {
        const fresh = await axios.get(`/api/seats?sessionId=${state.sessionId}`, { timeout: 3000 });
        dispatch({ type: 'SET_SEATS', payload: fresh.data.seats });
        dispatch({ type: 'SET_STATS', payload: fresh.data.stats });
        cacheSeatState(fresh.data.seats);
      } catch { /* use existing state */ }

      dispatch({ type: 'SET_LOADING', payload: false });
      return { success: true, data: data.booking };

    } catch (apiErr) {
      // Was the backend reachable? Check if we got a response (4xx/5xx) vs network error
      if (apiErr.response) {
        // Backend IS running but returned an error
        backendReachable = true;
        const respData = apiErr.response.data;

        // 409 = no seats available (genuine algorithm rejection)
        if (apiErr.response.status === 409 && respData?.rejection) {
          dispatch({ type: 'SET_LOADING', payload: false });
          return { success: false, error: respData.message, rejection: respData.rejection };
        }

        // Other backend error — show it
        dispatch({ type: 'SET_LOADING', payload: false });
        return { success: false, error: respData?.error || `Server error: ${apiErr.response.status}` };
      }
      // Network error → backend not running → fall through to client-side
    }

    // ── 2. Client-side fallback (only when backend is unreachable) ────────────
    let workingSeats = state.seats;

    if (!workingSeats || workingSeats.length === 0) {
      workingSeats = buildInMemoryLayout(state.sessionId);
      cacheSeatState(workingSeats);
      dispatch({ type: 'SET_SEATS', payload: workingSeats });
      dispatch({ type: 'SET_STATS', payload: calculateFragmentationClient(workingSeats) });
    }

    // Rebuild if too few seats available for the requested group
    const avail = workingSeats.filter(s => s.status === 'available' && s.type !== 'broken').length;
    if (avail < bookingData.groupSize) {
      workingSeats = buildInMemoryLayout(state.sessionId);
      cacheSeatState(workingSeats);
      dispatch({ type: 'SET_SEATS', payload: workingSeats });
      dispatch({ type: 'SET_STATS', payload: calculateFragmentationClient(workingSeats) });
    }

    // Manual seat selection: use the pre-selected seats directly
    let result;
    if (bookingData._manualSeats && bookingData._manualSeats.length > 0) {
      const manualSeatsInState = bookingData._manualSeats.map(ms => {
        return workingSeats.find(s => s.row === ms.row && s.number === ms.number) || ms;
      });
      result = {
        seats: manualSeatsInState,
        score: 0,
        row: manualSeatsInState[0]?.row,
        notes: `Manual selection — Row ${manualSeatsInState[0]?.row}, seats ${manualSeatsInState.map(s=>s.number).sort((a,b)=>a-b).join(', ')}`,
      };
    } else {
      result = allocateSeatsClient(
        workingSeats,
        bookingData.groupSize,
        bookingData.wantsVip,
        bookingData.needsAccessible,
      );
    }

    if (result.error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return { success: false, error: result.message };
    }

    const updatedSeats = workingSeats.map(seat => {
      const hit = result.seats.some(r => r.row === seat.row && r.number === seat.number);
      return hit ? { ...seat, status: 'booked' } : seat;
    });

    const booking = {
      bookingRef:      `CIN-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      customerName:    bookingData.customerName,
      customerEmail:   bookingData.customerEmail,
      groupSize:       bookingData.groupSize,
      seats:           result.seats.map(s => ({ row: s.row, number: s.number, seatType: s.type || s.seatType || 'regular' })),
      allocationScore: result.score,
      allocationNotes: result.notes,
      status:          'confirmed',
      createdAt:       new Date().toISOString(),
      sessionId:       state.sessionId,
      guestId,
      userType,
    };

    saveBookingLocally(booking);
    cacheSeatState(updatedSeats);

    dispatch({ type: 'SET_SEATS',        payload: updatedSeats });
    dispatch({ type: 'SET_STATS',        payload: calculateFragmentationClient(updatedSeats) });
    dispatch({ type: 'SET_LAST_BOOKING', payload: { booking, allocatedSeats: result.seats } });
    dispatch({ type: 'SET_LOADING',      payload: false });
    return { success: true, data: booking };

  }, [state.seats, state.sessionId]);

  const resetLayout = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    clearSeatCache();
    try {
      await axios.post('/api/seats/reset', { sessionId: state.sessionId }, { timeout: 4000 });
      await loadSeats(state.sessionId);
    } catch {
      const seats = buildInMemoryLayout(state.sessionId);
      cacheSeatState(seats);
      dispatch({ type: 'SET_SEATS', payload: seats });
      dispatch({ type: 'SET_STATS', payload: calculateFragmentationClient(seats) });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.sessionId, loadSeats]);

  const runSimulation = useCallback(async () => ({ success: true, data: null }), []);

  return (
    <CinemaContext.Provider value={{
      ...state, loadSeats, bookSeats, resetLayout, runSimulation, dispatch
    }}>
      {children}
    </CinemaContext.Provider>
  );
}

export function useCinema() {
  const ctx = useContext(CinemaContext);
  if (!ctx) throw new Error('useCinema must be used within CinemaProvider');
  return ctx;
}
