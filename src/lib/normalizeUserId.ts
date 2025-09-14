// Normalize scanned or pasted user ID values before using them in lookups.
// Common problem: barcodes encoded as EAN-13 can append 3 extra digits like "001"
// Example: user ID "1016718391" may be scanned as "1016718391001".
// This helper strips non-digits and applies a conservative heuristic:
// - Remove trailing "001" if present and the remaining length is >= 6
// - Otherwise return the digits-only string unchanged
// Async normalizer: when a candidate looks ambiguous (e.g. length 13), perform a
// very fast existence check against the users endpoint to decide whether to keep
// the candidate as-is or to try trimmed variants. This avoids incorrectly
// trimming valid 13-digit IDs like `7000001334428` while still fixing common
// scanner EAN-13 encodings that append 3 digits (e.g. `1016718391001`).
export async function normalizeUserId(raw: string | null | undefined): Promise<string> {
  if (!raw) return '';
  const s = String(raw).trim();
  if (s === '') return '';
  const digits = s.replace(/\D/g, '');

  if (!digits) return s;

  // Fast path: short values are canonical
  if (digits.length <= 10) return digits;

  // Helper: fetch with timeout
  async function existsInSystem(candidate: string, timeout = 1200): Promise<boolean> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(`/api/sheets/users?userId=${encodeURIComponent(candidate)}`, { signal: controller.signal });
      clearTimeout(id);
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  // If it's exactly 13 digits, prefer keeping it if it exists in the backend.
  if (digits.length === 13) {
    if (await existsInSystem(digits)) return digits;

    // If the 13-digit value doesn't exist, try trimming the last 3 digits
    const trimmed3 = digits.slice(0, -3);
    if ((trimmed3.length === 10 || trimmed3.length === 9) && await existsInSystem(trimmed3)) {
      return trimmed3;
    }
  }

  // For lengths >= 13 attempt the common EAN-13 trim heuristic but verify on the backend
  if (digits.length >= 13) {
    const trimmed3 = digits.slice(0, -3);
    if ((trimmed3.length === 10 || trimmed3.length === 9) && await existsInSystem(trimmed3)) {
      return trimmed3;
    }
  }

  // Legacy/trusted suffix heuristics: if it ends with 001/000 try trimmed candidate
  if (digits.length > 6 && (digits.endsWith('001') || digits.endsWith('000'))) {
    const candidate = digits.slice(0, -3);
    if (candidate.length >= 6 && await existsInSystem(candidate)) return candidate;
  }

  // Try removing 1..3 trailing digits and prefer the first candidate that exists
  for (let trim = 1; trim <= 3; trim++) {
    if (digits.length - trim >= 6) {
      const cand = digits.slice(0, digits.length - trim);
      if ((cand.length === 10 || cand.length === 9) && await existsInSystem(cand)) return cand;
    }
  }

  // As a last resort, return the original digits (so valid 13-digit values are preserved
  // when the backend doesn't claim a trimmed variant exists either).
  return digits;
}

// Helper: check if a candidate looks like a canonical user id for logging/tests
export function isLikelyCanonicalId(candidate: string): boolean {
  const d = (candidate || '').replace(/\D/g, '');
  return d.length === 10 || d.length === 9;
}
