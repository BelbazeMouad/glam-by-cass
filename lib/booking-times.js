/* ============================================================
   BOOKING TIME RULES — one source of truth.
   Imported by BOTH the booking page and the checkout API so the
   times a client can see and the times the server allows can
   never disagree.
   ============================================================ */

// Bookable hours (24h). 8 = 8:00am, 18 = 6:00pm.
export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 18;

// How far apart two bookings must be, in minutes.
export const GAP_MINUTES = 45;

// How fine the picker's steps are, in minutes.
export const STEP_MINUTES = 15;

/** "14:30" -> 870 (minutes since midnight). Returns null if unparseable. */
export function toMinutes(hhmm) {
  if (typeof hhmm !== 'string') return null;
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** 870 -> "14:30" */
export function toHHMM(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 870 -> "2:30 PM" — friendlier for clients to read. */
export function toLabel(mins) {
  const h24 = Math.floor(mins / 60), m = mins % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Every selectable time in the day, as minutes since midnight. */
export function allSlots() {
  const out = [];
  for (let t = OPEN_HOUR * 60; t <= CLOSE_HOUR * 60; t += STEP_MINUTES) out.push(t);
  return out;
}

/**
 * Is `candidate` too close to any already-booked time?
 * Blocked when it falls within GAP_MINUTES either side of a booking.
 * @param {number} candidate  minutes since midnight
 * @param {string[]} bookedTimes  e.g. ['10:00','14:30']
 */
export function isBlocked(candidate, bookedTimes = []) {
  for (const b of bookedTimes) {
    const bm = toMinutes(b);
    if (bm === null) continue;
    if (Math.abs(candidate - bm) < GAP_MINUTES) return true;
  }
  return false;
}

/** The booked time that blocks this candidate (for showing a helpful message). */
export function blockingTime(candidate, bookedTimes = []) {
  for (const b of bookedTimes) {
    const bm = toMinutes(b);
    if (bm === null) continue;
    if (Math.abs(candidate - bm) < GAP_MINUTES) return toLabel(bm);
  }
  return null;
}

/** Is this exact time string valid to book on a day with these bookings? */
export function isTimeBookable(hhmm, bookedTimes = []) {
  const t = toMinutes(hhmm);
  if (t === null) return { ok: false, reason: 'Please choose a time.' };
  if (t < OPEN_HOUR * 60 || t > CLOSE_HOUR * 60) {
    return { ok: false, reason: `Bookings are between ${toLabel(OPEN_HOUR * 60)} and ${toLabel(CLOSE_HOUR * 60)}.` };
  }
  const clash = blockingTime(t, bookedTimes);
  if (clash) {
    return { ok: false, reason: `Sorry, ${toLabel(t)} is too close to a booking at ${clash}. Please pick a time at least ${GAP_MINUTES} minutes away.` };
  }
  return { ok: true };
}
