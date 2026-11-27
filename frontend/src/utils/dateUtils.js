/**
 * Shared safe date parsing, formatting, and timezone calendar-date utilities.
 */

export function parseTimestampMs(rawValue) {
  if (!rawValue) return null;
  if (rawValue instanceof Date) {
    const ms = rawValue.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof rawValue !== 'string') return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  // Treat timezone-naive ISO timestamps as UTC (matching backend datetime normalization)
  const hasTzInfo = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const normalized = hasTzInfo ? trimmed : `${trimmed}Z`;
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? null : ms;
}

export function getReviewEffectiveTime(review) {
  const pubMs = parseTimestampMs(review?.reply_published_at) ?? 0;
  const revMs =
    parseTimestampMs(review?.review_created_at) ??
    parseTimestampMs(review?.created_at) ??
    0;
  return Math.max(pubMs, revMs);
}

export function formatSafeDate(rawValue, fallback = '—') {
  const ms = parseTimestampMs(rawValue);
  if (ms === null) return fallback;
  return new Date(ms).toLocaleDateString();
}

export function formatSafeDateTime(rawValue, fallback = '—') {
  const ms = parseTimestampMs(rawValue);
  if (ms === null) return fallback;
  return new Date(ms).toLocaleString();
}

export function formatSafeTimeAndDate(rawValue, fallback = 'Pending first sync') {
  const ms = parseTimestampMs(rawValue);
  if (ms === null) return fallback;
  const d = new Date(ms);
  return `${d.toLocaleTimeString()} · ${d.toLocaleDateString()}`;
}

export function formatSafeIsoString(rawValue, fallback = 'unknown-date') {
  const ms = parseTimestampMs(rawValue);
  if (ms === null) return fallback;
  return new Date(ms).toISOString();
}

export function toCalendarDateString(dateObj, timeZone = 'Asia/Kolkata') {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(dateObj);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback for fixed-offset strings such as +05:30
  }

  const offsetMatch = /^(?:UTC)?([+-])(\d{2}):?(\d{2})$/i.exec((timeZone || '').trim());
  if (offsetMatch) {
    const sign = offsetMatch[1] === '+' ? 1 : -1;
    const offsetMinutes = sign * (parseInt(offsetMatch[2], 10) * 60 + parseInt(offsetMatch[3], 10));
    const shifted = new Date(dateObj.getTime() + offsetMinutes * 60000);
    return shifted.toISOString().slice(0, 10);
  }

  if ((timeZone || '').trim().toUpperCase() === 'UTC') {
    return dateObj.toISOString().slice(0, 10);
  }

  const istFallback = new Date(dateObj.getTime() + 330 * 60000);
  return istFallback.toISOString().slice(0, 10);
}

export function shiftCalendarDateString(ymd, deltaDays) {
  const [y, m, d] = ymd.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return shifted.toISOString().slice(0, 10);
}
