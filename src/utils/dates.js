export const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const day = DAYS_HE[d.getDay()];
  return `יום ${day}, ${d.getDate()} ב${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export function getNextWeekday(dayOfWeek) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentDay = today.getDay();
  let daysUntil = (dayOfWeek - currentDay + 7) % 7;
  if (daysUntil === 0) daysUntil = 7;
  const next = new Date(today);
  next.setDate(today.getDate() + daysUntil);
  return next.toISOString().split('T')[0];
}

export function toLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isPast(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T23:59:59');
  return d < new Date();
}

export function isToday(dateStr) {
  if (!dateStr) return false;
  const today = toLocalDateString();
  return dateStr === today;
}

export function generateId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
  return diff;
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

export function daysUntilLabel(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return '';
  if (d < 0) return 'עבר';
  if (d === 0) return 'היום';
  if (d === 1) return 'מחר';
  if (d <= 6) return `בעוד ${d} ימים`;
  if (d === 7) return 'בעוד שבוע';
  return `בעוד ${d} ימים`;
}
