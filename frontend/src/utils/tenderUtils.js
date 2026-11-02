/**
 * Tender utility helpers for date parsing, deadline verification, and status resolution.
 */

/**
 * Normalises status across all API, database, and smart contract casing variations.
 * Handles "Awarded", "AWARDED", "UnderEvaluation", "Disputed", "DisputeResolved", "Finalized", "Cancelled", "Created", "OPEN".
 */
export function normalizeTenderStatus(status) {
  if (!status) return '';
  return String(status).trim().toLowerCase();
}

/**
 * Check if a tender is in the Awarded state (case-insensitive).
 */
export function isTenderAwarded(tenderOrStatus) {
  const status = typeof tenderOrStatus === 'object' && tenderOrStatus !== null ? tenderOrStatus.status : tenderOrStatus;
  return normalizeTenderStatus(status) === 'awarded';
}

/**
 * Check if a tender is in Awarded or post-award lifecycle state (Disputed, DisputeResolved, Finalized).
 */
export function isPostAward(tenderOrStatus) {
  const status = typeof tenderOrStatus === 'object' && tenderOrStatus !== null ? tenderOrStatus.status : tenderOrStatus;
  const s = normalizeTenderStatus(status);
  return ['awarded', 'disputed', 'disputeresolved', 'finalized'].includes(s);
}

/**
 * Check if a tender is in pre-award lifecycle state (Created, UnderEvaluation, OPEN).
 */
export function isPreAward(tenderOrStatus) {
  const status = typeof tenderOrStatus === 'object' && tenderOrStatus !== null ? tenderOrStatus.status : tenderOrStatus;
  const s = normalizeTenderStatus(status);
  return s === 'created' || s === 'underevaluation' || s === 'open' || s === 'closing soon';
}

/**
 * Format block string or number cleanly without duplicate prefixes like "Block #Block #...".
 */
export function formatBlockNumber(val) {
  if (!val) return 'Mined On-Chain';
  const str = String(val).trim();
  if (str.toLowerCase().startsWith('block')) return str;
  return `Block #${str}`;
}

/**
 * Format date values consistently for display.
 */
export function formatTenderDate(dateVal) {
  if (!dateVal) return 'Pending';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  } catch (e) {
    return String(dateVal);
  }
}

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
