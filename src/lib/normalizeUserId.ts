// Normalize scanned or pasted user ID values before using them in lookups.
// Common problem: barcodes encoded as EAN-13 can append 3 extra digits like "001"
// Example: user ID "1016718391" may be scanned as "1016718391001".
// This helper strips non-digits and applies a conservative heuristic:
// - Remove trailing "001" if present and the remaining length is >= 6
// - Otherwise return the digits-only string unchanged
export function normalizeUserId(raw: string | null | undefined): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (s === '') return '';
  const digits = s.replace(/\D/g, '');

  // If there are no digits, return the original trimmed string
  if (!digits) return s;

  // If already short (<= 10) just return digits — assume canonical
  if (digits.length <= 10) return digits;

  // Common case: scanners encode an ID as EAN-13 by appending 3 check/prefix digits.
  // If we see a 13+ length numeric and removing the last 3 digits produces a plausible
  // canonical length (9 or 10) then prefer that.
  if (digits.length >= 13) {
    const trimmed3 = digits.slice(0, -3);
    if (trimmed3.length === 10 || trimmed3.length === 9) return trimmed3;
  }

  // Legacy heuristic: strip trailing '001' or '000' if that yields at least 6 digits.
  if (digits.length > 6 && (digits.endsWith('001') || digits.endsWith('000'))) {
    const candidate = digits.slice(0, -3);
    if (candidate.length >= 6) return candidate;
  }

  // As a last attempt, try removing 1..3 trailing digits and if one produces a 9-10
  // digit candidate prefer it. This handles some scanners that add 1-3 extra digits.
  for (let trim = 1; trim <= 3; trim++) {
    if (digits.length - trim >= 6) {
      const cand = digits.slice(0, digits.length - trim);
      if (cand.length === 10 || cand.length === 9) return cand;
    }
  }

  // Fallback: return digits-only value
  return digits;
}

// Helper: check if a candidate looks like a canonical user id for logging/tests
export function isLikelyCanonicalId(candidate: string): boolean {
  const d = (candidate || '').replace(/\D/g, '');
  return d.length === 10 || d.length === 9;
}
