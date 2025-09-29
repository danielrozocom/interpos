// Parse currency-like strings ("$0", "-$17,800", "17.50") into numbers
export function parseCurrency(value: any): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  let s = String(value).trim();
  if (s === '') return 0;

  // Remove common currency thousands separators and spaces
  s = s.replace(/\s+/g, '');
  // Remove thousands separator comma
  s = s.replace(/,/g, '');
  // Remove currency symbols and any characters except digits, minus and dot
  s = s.replace(/[^0-9.-]+/g, '');

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export default parseCurrency;
