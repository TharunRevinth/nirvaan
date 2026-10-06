/**
 * Tender utility helpers for date parsing, deadline verification, and status resolution.
 */

export function isTenderDeadlineOver(tender) {
  if (!tender) return false;
  if (tender.isExpired) return true;
  if (!tender.deadline) return false;

  const raw = String(tender.deadline).replace(/\(EXPIRED\)/i, '').trim();
  // Timer countdown format like "12:45:10"
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(raw)) {
    return false;
  }

  const clean = raw.replace(' ', 'T');
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return d.getTime() <= Date.now();
  }
  return false;
}
