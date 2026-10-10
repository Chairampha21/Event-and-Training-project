// Thai-style 24-hour clock times: written with a dot and "น." ("08.30 น."),
// no AM/PM. Internally a time is always "HH:MM" (what <input type="time"> used
// to give and what the backend stores for per-day times).

/**
 * Reads a time the way people type it — "8.30", "08:30", "0830", "830", "16",
 * with or without a trailing "น." — and returns "HH:MM", or null if it isn't
 * a real 24-hour time.
 */
export function parseTime(text) {
  const s = String(text ?? '').trim().replace(/\s*น\.?$/, '').trim();
  let h; let m;
  let match = /^(\d{1,2})\s*[.:]\s*(\d{1,2})$/.exec(s);
  if (match) { h = Number(match[1]); m = Number(match[2]); if (match[2].length === 1) m *= 10; } // "8.3" = 08.30
  else if ((match = /^(\d{1,2})(\d{2})$/.exec(s))) { h = Number(match[1]); m = Number(match[2]); }
  else if ((match = /^(\d{1,2})$/.exec(s))) { h = Number(match[1]); m = 0; }
  else return null;
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "08:30" -> "08.30" (no suffix); '' for anything unset. */
export function toThaiTime(hhmm) {
  return hhmm ? hhmm.replace(':', '.') : '';
}

/** "08:30", "16:00" -> "08.30–16.00 น."; '' unless both are set. */
export function formatTimeRange(start, end) {
  return start && end ? `${toThaiTime(start)}–${toThaiTime(end)} น.` : '';
}

/**
 * Pulls the start and end out of a stored range text ("09:00–16:00 น." from
 * older events, "09.00–16.00 น." now). Returns ["HH:MM", "HH:MM"] or null.
 */
export function parseTimeRange(text) {
  const match = /^\s*(\d{1,2}[.:]\d{2})\s*[–-]\s*(\d{1,2}[.:]\d{2})/.exec(text || '');
  if (!match) return null;
  const start = parseTime(match[1]); const end = parseTime(match[2]);
  return start && end ? [start, end] : null;
}
