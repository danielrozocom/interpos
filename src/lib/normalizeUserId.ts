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

  // Heuristic: if the scanned code ends with '001' and removing it leaves a plausible ID,
  // strip that suffix. We require the remaining length to be >= 6 to avoid over-trimming.
  if (digits.length > 6 && digits.endsWith('001')) {
    const candidate = digits.slice(0, -3);
    if (candidate.length >= 6) return candidate;
  }

  // If it ends with '000' it's sometimes a padded code; strip trailing triple zeros as well
  if (digits.length > 6 && digits.endsWith('000')) {
    const candidate = digits.slice(0, -3);
    if (candidate.length >= 6) return candidate;
  }

  // Fallback: return digits-only value
  return digits;
}
