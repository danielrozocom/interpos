// Normalize scanned or pasted user ID values before using them in lookups.
// Common problem: barcodes encoded as EAN-13 can append 3 extra digits like "001"
// Example: user ID "1016718391" may be scanned as "1016718391001".
// This helper strips non-digits and applies a conservative heuristic:
// - Remove trailing "001" if present and the remaining length is >= 6
// - Otherwise return the digits-only string unchanged

export async function normalizeUserId(raw: string | null | undefined): Promise<string> {
  if (!raw) return '';
  const s = String(raw).trim();
  if (s === '') return '';
  const digits = s.replace(/\D/g, '');

  if (!digits) return s;

  // Fast path: short values are canonical
  if (digits.length <= 10) return digits;

  // Simple heuristic without backend calls to avoid infinite loops
  // For lengths >= 13, try trimming the last 3 digits if they are "001" or "000"
  if (digits.length >= 13) {
    const lastThree = digits.slice(-3);
    if (lastThree === '001' || lastThree === '000') {
      const trimmed = digits.slice(0, -3);
      if (trimmed.length >= 6) {
        return trimmed;
      }
    }
  }

  // Try common EAN-13 suffix patterns
  if (digits.length > 6 && (digits.endsWith('001') || digits.endsWith('000'))) {
    const candidate = digits.slice(0, -3);
    if (candidate.length >= 6) return candidate;
  }

  // As a last resort, return the original digits
  return digits;
}

// Helper: check if a candidate looks like a canonical user id for logging/tests
export function isLikelyCanonicalId(candidate: string): boolean {
  const d = (candidate || '').replace(/\D/g, '');
  return d.length === 10 || d.length === 9;
}
