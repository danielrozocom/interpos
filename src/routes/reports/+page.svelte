<script lang="ts">
  import { onMount, afterUpdate, onDestroy } from 'svelte';
  import { siteName } from '../../lib/config';

  let startDate: string = '';
  let endDate: string = '';
  // timezone to use for report date inputs (Colombia)
  const TIMEZONE = 'America/Bogota';
  // local date formatter (YYYY-MM-DD) using a fixed timezone to avoid client UTC offset issues
  function formatLocalISO(d: Date, timeZone: string = TIMEZONE) {
    try {
      // 'en-CA' produces YYYY-MM-DD which matches the input[type=date] format
      return d.toLocaleDateString('en-CA', { timeZone });
    } catch (e) {
      // fallback to manual local components if toLocaleDateString fails
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    }
  }
  const today = formatLocalISO(new Date(), TIMEZONE);
  let loading = false;
  let error = '';
  let summary: any = null;
  let exporting = false;
  let exportMessage = '';
  let showExportMenu = false;
  let selectedExportFormat: string | null = null;
  // Auto-fetch control
  let _hasMounted = false;
  let _autoFetchTimer: ReturnType<typeof setTimeout> | null = null;
  const AUTO_FETCH_DEBOUNCE = 500; // ms
  // Applied (last-successful) range shown in headings and used for exports
  let appliedStart: string = '';
  let appliedEnd: string = '';
  // Removed duplicate declaration of lastFetchedRange
  

  function toggleExportMenu() {
    showExportMenu = !showExportMenu;
  }

  function closeExportMenu() {
    showExportMenu = false;
  }

  // Date presets helpers
  function formatDateISO(d: Date) {
    return formatLocalISO(d, TIMEZONE);
  }
  function handleDocClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    // if clicked outside export menu/button, close
    if (!target) return;
    if (!target.closest) return;
    const inside = target.closest('.export-popover') || target.closest('.export-button');
    if (!inside) closeExportMenu();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeExportMenu();
  }
  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', handleDocClick);
      document.removeEventListener('keydown', handleKeydown);
    }
    try { if (_autoFetchTimer) { clearTimeout(_autoFetchTimer); _autoFetchTimer = null; } } catch (e) {}
  });

  let salesChart: any = null;
  let recargasChart: any = null;
  let salesCanvas: HTMLCanvasElement | null = null;
  let recargasCanvas: HTMLCanvasElement | null = null;
  let lastFetchedRange = '';

  const fetchSummary = async (opts?: { force?: boolean }) => {
    const force = opts?.force === true;
    // clamp endDate for requests so it never exceeds today
    const effEnd = endDate && endDate > today ? today : endDate;
    const key = `${startDate || ''}|${effEnd || ''}`;

    // If we've already fetched this exact range and not forcing, skip
    if (!force && key && lastFetchedRange === key) {
      return;
    }

    // cancel any pending auto-fetch debounce to avoid duplicate calls
    try { if (_autoFetchTimer) { clearTimeout(_autoFetchTimer); _autoFetchTimer = null; } } catch (e) {}

    loading = true;
    error = '';
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (effEnd) params.set('endDate', effEnd);
    const res = await fetch('/api/reports/summary?' + params.toString());
    if (!res.ok) throw new Error('Error fetching report');
  summary = await res.json();
  console.debug('reports: fetched summary from API', { key, summary });
  try {
    const recByMethod = (summary && summary.summary && summary.summary.recargasCountsByMethod) ? summary.summary.recargasCountsByMethod : {};
    const serverCounts = (summary && summary.summary && summary.summary.counts) ? summary.summary.counts : {};
    const derivedCash = Object.entries(recByMethod).reduce((s: number, [k, v]) => {
      try { return String(k || '').toLowerCase().includes('efectivo') ? s + Number(v || 0) : s; } catch (e) { return s; }
    }, 0);
    const derivedInternal = Object.entries(recByMethod).reduce((s: number, [k, v]) => {
      try { const nk = String(k || '').toLowerCase(); return (nk.includes('operacion') || nk.includes('interna') || nk.includes('operacional') || nk.includes('internal')) ? s + Number(v || 0) : s; } catch (e) { return s; }
    }, 0);
    const serverCash = Number(serverCounts.recargas_efectivo || 0);
    const serverInternal = Number(serverCounts.recargas_interna || 0);
    const sourceCash = (derivedCash > 0) ? 'derived' : (serverCash > 0 ? 'server' : 'none');
    const sourceInternal = (derivedInternal > 0) ? 'derived' : (serverInternal > 0 ? 'server' : 'none');
    const chosenCash = sourceCash === 'derived' ? derivedCash : (sourceCash === 'server' ? serverCash : 0);
    const chosenInternal = sourceInternal === 'derived' ? derivedInternal : (sourceInternal === 'server' ? serverInternal : 0);
    console.debug('reports: recargas counts chosen', { chosenCash, sourceCash, derivedCash, serverCash, chosenInternal, sourceInternal, derivedInternal, serverInternal, serverTotal: Number(serverCounts.recargas || 0) });
  } catch (e) { console.debug('reports: recargas inspect error', e); }
  // Charts are updated by the `afterUpdate` hook when `summary` changes.
  // Avoid calling updateCharts() directly here to prevent duplicate
  // destroys/creations and potential afterUpdate -> update -> afterUpdate loops.
  // mark this range as fetched and update applied range for UI
  lastFetchedRange = key;
  appliedStart = startDate || '';
  appliedEnd = effEnd || '';
    } catch (e: any) {
      error = e.message || String(e);
      summary = null;
    }
    loading = false;
  };

  onMount(async () => {
    // Por defecto seleccionar hoy en la zona horaria de Colombia
    const iso = formatLocalISO(new Date(), TIMEZONE);
    startDate = iso;
    endDate = iso;
    await fetchSummary();
    _hasMounted = true;
  });

  // Date preset helpers
  function fmt(d: Date) {
    return formatLocalISO(d, TIMEZONE);
  }

    // Date presets for quick selection (end date is always today)
    const presets = [
      {
        label: 'Hoy',
        getRange: () => {
          const today = new Date();
          const iso = formatLocalISO(today, TIMEZONE);
          return { start: iso, end: iso };
        }
      },
      {
        label: 'Esta semana',
        getRange: () => {
          const now = new Date();
          // Calculate Monday of current week (week starts Monday)
          const day = now.getDay(); // 0 (Sun) - 6 (Sat)
          const diffToMonday = ((day + 6) % 7); // 0 for Monday, 6 for Sunday
          const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
          const isoStart = formatLocalISO(monday, TIMEZONE);
          const isoEnd = formatLocalISO(now, TIMEZONE);
          return { start: isoStart, end: isoEnd };
        }
      },
      {
        label: 'Este mes',
        getRange: () => {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          const isoStart = formatLocalISO(start, TIMEZONE);
          const isoEnd = formatLocalISO(now, TIMEZONE);
          return { start: isoStart, end: isoEnd };
        }
      },
      {
        label: 'Este año',
        getRange: () => {
          const now = new Date();
          const start = new Date(now.getFullYear(), 0, 1);
          const isoStart = formatLocalISO(start, TIMEZONE);
          const isoEnd = formatLocalISO(now, TIMEZONE);
          return { start: isoStart, end: isoEnd };
        }
      }
      ,{
        label: 'Todos',
        getRange: () => ({ start: '', end: '' })
      }
    ];
  function setRange(start: Date, end: Date) {
    // ensure start/end do not exceed today
    const s = fmt(start);
    startDate = s > today ? today : s;
    const candidate = fmt(end);
    endDate = candidate > today ? today : candidate;
    // fetch after setting the range
    fetchSummary();
  }

  // Keep startDate <= endDate and endDate >= startDate when users change inputs
  function onStartDateChange() {
    try {
      if (startDate && endDate && startDate > endDate) {
        // user increased start beyond end -> move end forward
        endDate = startDate;
      }
    } catch (e) { /* ignore */ }
  }

  function onEndDateChange() {
    try {
      if (startDate && endDate && endDate < startDate) {
        // user decreased end before start -> move start back
        startDate = endDate;
      }
    } catch (e) { /* ignore */ }
  }

  // Clamp helper: ensures dateStr (YYYY-MM-DD) lies between min and max if provided
  function clampDateStr(dateStr: string, min?: string, max?: string) {
    if (!dateStr) return dateStr;
    // basic format check
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    if (min && dateStr < min) return min;
    if (max && dateStr > max) return max;
    return dateStr;
  }

  // Prevent typing a start date that would be after endDate or after today
  function onStartDateInput() {
    try {
      const maxAllowed = endDate ? (endDate < today ? endDate : today) : today;
      const clamped = clampDateStr(startDate, undefined, maxAllowed);
      if (clamped !== startDate) startDate = clamped;
    } catch (e) { /* ignore */ }
  }

  // Prevent typing an end date that would be before startDate or after today
  function onEndDateInput() {
    try {
      const minAllowed = startDate || undefined;
      const clamped = clampDateStr(endDate, minAllowed, today);
      if (clamped !== endDate) endDate = clamped;
    } catch (e) { /* ignore */ }
  }

  // Apply range values directly (strings). Sets both values then fetches once to avoid UI flash.
  function applyRange(s: string, e: string) {
    // set both values synchronously
    startDate = s;
    endDate = e;
    // clear any pending auto-fetch debounce to avoid duplicate calls
    try { if (_autoFetchTimer) { clearTimeout(_autoFetchTimer); _autoFetchTimer = null; } } catch (e) {}
    // call fetch after both set
    fetchSummary();
  }

  // typed click handler to invoke fetchSummary (avoids passing MouseEvent into fetchSummary)
  function handleApplyClick(e: MouseEvent) {
    // prevent default if used inside a form button
    try { if ((e as any).preventDefault) (e as any).preventDefault(); } catch (err) {}
    void fetchSummary();
  }

// Auto-apply when user edits the date inputs (debounced). Only after initial mount.
$: if (_hasMounted) {
  // reference startDate/endDate so this reactive runs when they change
  const _s = startDate;
  const _e = endDate;
  if (_autoFetchTimer) {
    clearTimeout(_autoFetchTimer);
    _autoFetchTimer = null;
  }
  _autoFetchTimer = setTimeout(() => {
    fetchSummary();
    _autoFetchTimer = null;
  }, AUTO_FETCH_DEBOUNCE);
}

  function presetToday() {
    const now = new Date();
    setRange(now, now);
  }

  function presetLastWeek() {
    const now = new Date();
    const prior = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    setRange(prior, now);
  }

  function presetLastMonth() {
    const now = new Date();
    const prior = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    setRange(prior, now);
  }

  function presetThisMonth() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setRange(first, last);
  }

  function presetYear() {
    const now = new Date();
    const first = new Date(now.getFullYear(), 0, 1);
    const last = new Date(now.getFullYear(), 11, 31);
    setRange(first, last);
  }

  function isPresetActive(preset: any) {
    // Normalize both preset and current range to empty string fallback and compare
    const range = preset.getRange();
    const rs = range.start || '';
    const re = range.end || '';
    const cs = startDate || '';
    const ce = endDate || '';
    return rs === cs && re === ce;
  }

  function formatCurrency(n: number) {
    // Use en-US locale so thousands use commas: e.g. $1,316,000
    return `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  }

  // Robust number parser reused across the file
  function toNumber(val: any) {
    if (typeof val === 'number') return val;
    if (!val && val !== 0) return 0;
    let s = String(val);
    s = s.replace(/[$\s]/g, '');
    if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) {
      s = s.replace(/\./g, '').replace(/,/g, '.');
    } else {
      s = s.replace(/,/g, '');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  // Return a string like "1 transacción" or "2 transacciones"
  function txLabel(count: number | string | undefined | null) {
    const v = Number(count || 0);
    return `${v} ${v === 1 ? 'transacción' : 'transacciones'}`;
  }

  // Helper: return true when value is non-zero (used by template to toggle emphasis)
  function isZero(val: any) {
    try { return Number(val || 0) !== 0; } catch (e) { return false; }
  }

  // Return CSS classes for count display; emphasize when non-zero
  function countClass(val: any) {
    const base = 'text-sm text-gray-400';
    try {
      if (Number(val || 0) > 0) return `${base} text-base font-medium`;
    } catch (e) { /* ignore */ }
    return base;
  }

  // Return a user-facing range string. If both empty -> 'Todas las fechas'
  function displayRange(a: string | undefined | null, b: string | undefined | null) {
    const A = a || '';
    const B = b || '';
    if (!A && !B) return 'Todas las fechas';
  return `${A || '...'} - ${B || '...'}`;
  }

  // Return a filename-safe label: if both empty -> 'Todas las fechas', else 'A - B'
  function fileRangeLabel(a: string | undefined | null, b: string | undefined | null) {
    const A = a || '';
    const B = b || '';
    if (!A && !B) return 'Todas las fechas';
    return `${A || '...'} - ${B || '...'}`;
  }

  // reactive top products slice for UI
  $: topProductsList = (summary && summary.summary && Array.isArray(summary.summary.topProducts))
    ? summary.summary.topProducts.slice().sort((a: any, b: any) => {
        if ((b.quantity || 0) !== (a.quantity || 0)) return (b.quantity || 0) - (a.quantity || 0);
        const an = String(a.product || '').toLowerCase();
        const bn = String(b.product || '').toLowerCase();
        return an.localeCompare(bn, 'es', { sensitivity: 'base' });
      }).slice(0, 10)
    : [];
  $: maxTopQty = topProductsList.length ? Math.max(...topProductsList.map((t: any) => t.quantity)) : 1;
  // total units across the top products list (used for header pill)
  $: totalTopUnits = topProductsList.reduce((s: number, t: any) => s + Number(t.quantity || 0), 0);
  $: totalTopDistinct = topProductsList.length;

  // Derived totals computed from the same objects used to build charts
  $: derivedSalesByMethod = (summary && summary.summary && summary.summary.salesByMethod) ? summary.summary.salesByMethod : {};
  $: derivedRecargasByMethod = (summary && summary.summary && summary.summary.recargasByMethod) ? summary.summary.recargasByMethod : {};
  $: derivedSalesCountsByMethod = (summary && summary.summary && summary.summary.salesCountsByMethod) ? summary.summary.salesCountsByMethod : {};

  $: derivedTotalSales = Object.values(derivedSalesByMethod).reduce((s: number, v: any) => s + toNumber(v || 0), 0) || 0;
  $: derivedTotalSalesCash = Object.entries(derivedSalesByMethod).reduce((s: number, [k, v]) => k.toLowerCase().includes('efectivo') ? s + toNumber(v || 0) : s, 0) || 0;
  $: derivedCountsOrders = Object.values(derivedSalesCountsByMethod).reduce((s: number, v: any) => s + Number(v || 0), 0) || 0;

  // Derived counts per method to drive txLabel display and sizing
  $: derivedSalesSaldoCount = Object.entries(derivedSalesCountsByMethod).reduce((s: number, [k, v]) => k.toLowerCase().includes('saldo') ? s + Number(v || 0) : s, 0) || 0;
  $: derivedSalesCashCount = Object.entries(derivedSalesCountsByMethod).reduce((s: number, [k, v]) => k.toLowerCase().includes('efectivo') ? s + Number(v || 0) : s, 0) || 0;
  $: derivedRecargasCountsByMethod = (() => {
    const byMethod = (summary && summary.summary && summary.summary.recargasCountsByMethod) ? summary.summary.recargasCountsByMethod : {};
    // If server didn't provide a per-method breakdown but provided a total count, add a fallback entry
    try {
      const hasKeys = byMethod && Object.keys(byMethod).length > 0;
      const serverTotal = summary && summary.summary && summary.summary.counts && Number(summary.summary.counts.recargas || 0);
      if (!hasKeys && serverTotal && serverTotal > 0) {
        return { 'Total (server)': serverTotal };
      }
    } catch (e) { /* ignore */ }
    return byMethod;
  })();
  // Normalize keys (remove diacritics) and compute robust counts for recargas
  function normalizeKey(s: string) {
    // Use a combining-mark range to remove diacritics for broader compatibility
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  $: derivedRecargasCount = Object.values(derivedRecargasCountsByMethod).reduce((s: number, v: any) => s + Number(v || 0), 0) || 0;

  $: derivedRecargasCashCount = (() => {
    const entries = Object.entries(derivedRecargasCountsByMethod || {});
    return entries.reduce((s: number, [k, v]) => {
      const nk = normalizeKey(String(k || ''));
      if (nk.includes('efectivo') || nk.includes('cash')) return s + Number(v || 0);
      return s;
    }, 0);
  })() || 0;

  $: derivedRecargasInternalCount = (() => {
    const entries = Object.entries(derivedRecargasCountsByMethod || {});
    return entries.reduce((s: number, [k, v]) => {
      const nk = normalizeKey(String(k || ''));
      if (nk.includes('operacion') || nk.includes('interna') || nk.includes('internal') || nk.includes('operacional')) return s + Number(v || 0);
      return s;
    }, 0);
  })() || 0;

  // Display fallbacks and proportional estimates when per-method breakdown is missing
  $: serverTotalRecargas = Number(summary && summary.summary && summary.summary.counts && Number(summary.summary.counts.recargas || 0)) || 0;

  // Estimate counts proportionally to amounts when breakdown not provided
  $: estimatedRecargasCashCount = (() => {
    if (hasRecargasBreakdown) return 0;
    if (!serverTotalRecargas) return 0;
    const cashAmt = Number(derivedRecargasCash || 0);
    const internalAmt = Number(derivedRecargasInternal || 0);
    const denom = cashAmt + internalAmt;
    if (denom > 0) return Math.round(serverTotalRecargas * (cashAmt / denom));
    return Math.floor(serverTotalRecargas / 2);
  })();

  $: estimatedRecargasInternalCount = serverTotalRecargas - (Number(estimatedRecargasCashCount) || 0);

  $: displayRecargasCount = (derivedRecargasCount > 0) ? derivedRecargasCount : serverTotalRecargas;
  // Prefer derived (per-method breakdown), then server-provided counts, then manual overrides, then estimated fallback
  $: displayRecargasCashCount = (derivedRecargasCashCount > 0)
    ? derivedRecargasCashCount
    : (Number(summary && summary.summary && summary.summary.counts && summary.summary.counts.recargas_efectivo || 0) > 0 ? Number(summary.summary.counts.recargas_efectivo) : (estimatedRecargasCashCount > 0 ? estimatedRecargasCashCount : 0));
  $: displayRecargasInternalCount = (derivedRecargasInternalCount > 0)
    ? derivedRecargasInternalCount
    : (Number(summary && summary.summary && summary.summary.counts && summary.summary.counts.recargas_interna || 0) > 0 ? Number(summary.summary.counts.recargas_interna) : (estimatedRecargasInternalCount > 0 ? estimatedRecargasInternalCount : 0));

  // Debug UI control to inspect raw objects from server (toggleable)
  let showRecargasDebug = false;

  // Whether server provided a per-method breakdown for recargas
  $: hasRecargasBreakdown = Boolean(summary && summary.summary && summary.summary.recargasCountsByMethod && Object.keys(summary.summary.recargasCountsByMethod).length > 0);

  // no local manual overrides: rely solely on server/derived/estimated counts
    try {
    const recByMethod = (summary && summary.summary && summary.summary.recargasCountsByMethod) ? summary.summary.recargasCountsByMethod : {};
    const serverCounts = (summary && summary.summary && summary.summary.counts) ? summary.summary.counts : {};
    const derivedCash = Object.entries(recByMethod).reduce((s: number, [k, v]) => {
      try { return String(k || '').toLowerCase().includes('efectivo') ? s + Number(v || 0) : s; } catch (e) { return s; }
    }, 0);
    const derivedInternal = Object.entries(recByMethod).reduce((s: number, [k, v]) => {
      try { const nk = String(k || '').toLowerCase(); return (nk.includes('operacion') || nk.includes('interna') || nk.includes('operacional') || nk.includes('internal')) ? s + Number(v || 0) : s; } catch (e) { return s; }
    }, 0);
    const serverCash = Number(serverCounts.recargas_efectivo || 0);
    const serverInternal = Number(serverCounts.recargas_interna || 0);
    const sourceCash = (derivedCash > 0) ? 'derived' : (serverCash > 0 ? 'server' : 'none');
    const sourceInternal = (derivedInternal > 0) ? 'derived' : (serverInternal > 0 ? 'server' : 'none');
    const chosenCash = sourceCash === 'derived' ? derivedCash : (sourceCash === 'server' ? serverCash : 0);
    const chosenInternal = sourceInternal === 'derived' ? derivedInternal : (sourceInternal === 'server' ? serverInternal : 0);
    console.debug('reports: recargas counts chosen', { chosenCash, sourceCash, derivedCash, serverCash, chosenInternal, sourceInternal, derivedInternal, serverInternal, serverTotal: Number(serverCounts.recargas || 0) });
  } catch (e) { console.debug('reports: recargas inspect error', e); }

  // Compute sales paid with 'Saldo' (derived from salesByMethod when possible)
  $: derivedTotalSalesSaldo = (() => {
    try {
      const entries = Object.entries(derivedSalesByMethod || {});
      // find any keys that explicitly mention 'saldo'
      const matched = entries.filter(([k]) => {
        try { return String(k || '').toLowerCase().includes('saldo'); } catch (e) { return false; }
      });
      const sumMatched = matched.reduce((s: number, [, v]) => s + toNumber(v || 0), 0);
      if (sumMatched > 0) return sumMatched;
      // fallback: if no explicit 'saldo' label, infer as total - cash
      const inferred = Number(derivedTotalSales) - Number(derivedTotalSalesCash || 0);
      // debug list of keys and whether they match
      try { console.debug('reports: derivedTotalSalesSaldo keys:', entries.map(([k]) => k)); console.debug('reports: saldo-matches:', matched.map(m => m[0])); } catch (e) { /* ignore */ }
      return inferred > 0 ? inferred : 0;
    } catch (e) {
      console.debug('reports: derivedTotalSalesSaldo error', e);
      return 0;
    }
  })();

  $: derivedTotalRecargas = Object.values(derivedRecargasByMethod).reduce((s: number, v: any) => s + toNumber(v || 0), 0) || 0;
  $: derivedRecargasCash = Object.entries(derivedRecargasByMethod).reduce((s: number, [k, v]) => k.toLowerCase().includes('efectivo') ? s + toNumber(v || 0) : s, 0) || 0;
  $: derivedRecargasInternal = Object.entries(derivedRecargasByMethod).reduce((s: number, [k, v]) => (k.toLowerCase().includes('operación interna') || k.toLowerCase().includes('operacion interna')) ? s + toNumber(v || 0) : s, 0) || 0;

  // Quick mismatch detection between server-provided totals and derived totals (logs only)
  $: if (summary && summary.summary) {
    if (Number(summary.summary.totalSales || 0) !== Number(derivedTotalSales)) console.warn('Reports: server totalSales mismatch', summary.summary.totalSales, derivedTotalSales);
    if (Number(summary.summary.totalSalesCash || 0) !== Number(derivedTotalSalesCash)) console.warn('Reports: server totalSalesCash mismatch', summary.summary.totalSalesCash, derivedTotalSalesCash);
    if (Number(summary.summary.totalRecargas || 0) !== Number(derivedTotalRecargas)) console.warn('Reports: server totalRecargas mismatch', summary.summary.totalRecargas, derivedTotalRecargas);
  }

  // Clean product name for display: remove IDs, parenthesis, trailing xN and prices
  function cleanProductName(s: string | undefined | null) {
    if (!s) return '';
    let t = String(s);
    // remove content in parentheses e.g. (ID: 25)
    t = t.replace(/\([^)]*\)/g, '');
    // remove ID:123 or ID: 123
    t = t.replace(/\bID\s*:?\s*\d+\b/gi, '');
    // remove trailing quantity markers like x1 or x 1
    t = t.replace(/\bx\s*\d+\b/gi, '');
    // remove price patterns like - $8.000 or - 8.000
    t = t.replace(/[-–—]\s*\$?\s*[\d,.]+/g, '');
    // collapse multiple spaces and trim
    t = t.replace(/\s{2,}/g, ' ').trim();
    return t;
  }

  // Compute sales paid with 'Saldo' (case-insensitive) from salesByMethod when summary is available
  function totalSalesSaldo() {
    if (!summary || !summary.summary) return 0;
    const salesByMethod = summary.summary.salesByMethod || {};
    return Object.entries(salesByMethod).reduce((s, [k, v]) => {
      if (String(k).toLowerCase().includes('saldo')) return s + toNumber(v);
      return s;
    }, 0);
  }

  

  // Simple bar chart data helper for fallback list view
  function barChartData(obj: Record<string, number>) {
    const entries = Object.entries(obj);
    const total = entries.reduce((s, [, v]) => s + (Number(v) || 0), 0) || 1;
    return entries.map(([k, v]) => ({ label: k, value: Number(v), pct: (Number(v) || 0) / total }));
  }

  // Chart.js will be dynamically imported client-side
  async function ensureChartJs() {
    if (typeof window === 'undefined') return null;
    const mod = await import('chart.js/auto');
    return mod;
  }

  function updateCharts() {
    // Build datasets
    if (!summary || !summary.summary) return;
    const salesByMethod = summary.summary.salesByMethod || {};
    const recargasByMethod = summary.summary.recargasByMethod || {};

    // Debug logging to help diagnose mismatches between chart and card
    try {
      console.debug('reports:updateCharts salesByMethod:', salesByMethod);
      const computedSaldo = Object.entries(salesByMethod).reduce((s,[k,v]) => k.toLowerCase().includes('saldo') ? s + toNumber(v) : s, 0);
      console.debug('reports:updateCharts computedSaldo:', computedSaldo, 'derivedTotalSalesSaldo:', derivedTotalSalesSaldo);
    } catch (err) {
      console.warn('reports:updateCharts debug error', err);
    }

    const salesLabels = Object.keys(salesByMethod);
    const salesData = salesLabels.map(k => salesByMethod[k]);

    const recLabels = Object.keys(recargasByMethod);
    const recData = recLabels.map(k => recargasByMethod[k]);

    ensureChartJs().then((ChartModule: any) => {
      const Chart = ChartModule && ChartModule.default ? ChartModule.default : ChartModule;
      // Set global font to Nunito for charts
      try { Chart.defaults.font.family = 'Nunito, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'; } catch (e) { /* ignore */ }
      if (salesCanvas) {
        if (salesChart) salesChart.destroy();
        salesChart = new Chart(salesCanvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: salesLabels,
            datasets: [{ label: 'Ventas', data: salesData, backgroundColor: '#35528C' }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
            scales: {
              y: {
                ticks: {
                  callback: function(value: any) {
                    const n = Number(value);
                    if (Number.isInteger(n)) return n.toLocaleString('en-US');
                    // For fractional, format with up to 2 decimals, then replace dot with comma
                    return n.toLocaleString('en-US', {minimumFractionDigits:1, maximumFractionDigits:2}).replace('.', ',');
                  }
                }
              }
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                enabled: true,
                callbacks: {
                  label: function(context: any) {
                    return `${context.label}: ${formatCurrency(context.parsed.y)}`;
                  }
                }
              }
            }
          }
        });
      }

      if (recargasCanvas) {
        if (recargasChart) recargasChart.destroy();
        recargasChart = new Chart(recargasCanvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: recLabels,
            datasets: [{ label: 'Recargas', data: recData, backgroundColor: '#16a34a' }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
            scales: {
              y: {
                ticks: {
                  callback: function(value: any) {
                    const n = Number(value);
                    if (Number.isInteger(n)) return n.toLocaleString('en-US');
                    // For fractional, format with up to 2 decimals, then replace dot with comma
                    return n.toLocaleString('en-US', {minimumFractionDigits:1, maximumFractionDigits:2}).replace('.', ',');
                  }
                }
              }
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                enabled: true,
                callbacks: {
                  label: function(context: any) {
                    return `${context.label}: ${formatCurrency(context.parsed.y)}`;
                  }
                }
              }
            }
          }
        });
      }
    }).catch(err => console.warn('Chart.js load error', err));
  }

  // Copy canvas image to clipboard (with download fallback)
  async function copyCanvasImage(canvas: HTMLCanvasElement | null, filename = 'chart.png') {
    if (!canvas) return false;
    try {
      if ((navigator as any).clipboard && (navigator as any).clipboard.write) {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(b => resolve(b), 'image/png'));
        if (!blob) throw new Error('No blob from canvas');
        const item = new (window as any).ClipboardItem({ 'image/png': blob });
        await (navigator as any).clipboard.write([item]);
        return true;
      }
    } catch (err) {
      console.warn('Clipboard write failed', err);
    }
    // Fallback: download
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    return false;
  }

  let _lastSummaryKey = '';
  afterUpdate(() => {
      // Only update charts when the summary object actually changed to avoid
      // repeatedly destroying/recreating Chart.js instances which can cause
      // afterUpdate -> update -> afterUpdate loops in some environments.
      try {
        const key = summary ? JSON.stringify(summary.summary || {}) : '';
        if (key !== _lastSummaryKey) {
          _lastSummaryKey = key;
          updateCharts();
        }
      } catch (e) {
        // If serialization fails, fall back to a single update attempt
        if (!_lastSummaryKey) {
          _lastSummaryKey = 'err';
          updateCharts();
        }
      }
    });

  // Export helpers
  function toCSV(obj: Record<string, number>) {
    const rows = [['Método', 'Valor']];
    for (const k of Object.keys(obj)) rows.push([k, String(obj[k] || 0)]);
    return rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  }

  async function exportCSV() {
    if (!summary) return;
    if (typeof document === 'undefined') return;
    exporting = true; exportMessage = 'Generando CSV...';
    try {
      const salesCsv = toCSV(summary.summary.salesByMethod || {});
      const recCsv = toCSV(summary.summary.recargasByMethod || {});
  const header = `Reporte InterPOS - Ventas y Recargas\n${displayRange(appliedStart || startDate, appliedEnd || endDate)}\n\n`;
      const blob = new Blob([header, "Ventas\n", salesCsv, "\n\nRecargas\n", recCsv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `report_${startDate || 'all'}_${endDate || 'all'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      exportMessage = 'CSV generado';
    } finally { setTimeout(()=>{ exporting=false; exportMessage=''; }, 1200); }
  }

  async function exportExcel() {
    if (!summary) return;
    if (typeof document === 'undefined') return;
    exporting = true; exportMessage = 'Generando Excel...';
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      // Create sheets with proper headers and numeric types
      const salesRows = Object.entries(summary.summary.salesByMethod || {}).map(([k, v]) => ({ Metodo: k, Valor: Number(v) }));
      const recRows = Object.entries(summary.summary.recargasByMethod || {}).map(([k, v]) => ({ Metodo: k, Valor: Number(v) }));
      const salesSheet = XLSX.utils.json_to_sheet(salesRows, { header: ['Metodo','Valor'] });
      const recSheet = XLSX.utils.json_to_sheet(recRows, { header: ['Metodo','Valor'] });
      // Set column type for Valor as number if present
      const setNumberColumn = (sheet:any) => {
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
        for (let R = range.s.r+1; R <= range.e.r; ++R) {
          const cellAddress = { c: 1, r: R };
          const cellRef = XLSX.utils.encode_cell(cellAddress);
          if (sheet[cellRef]) {
            sheet[cellRef].t = 'n';
            sheet[cellRef].v = Number(sheet[cellRef].v || 0);
          }
        }
      };
      setNumberColumn(salesSheet); setNumberColumn(recSheet);
      XLSX.utils.book_append_sheet(wb, salesSheet, 'Ventas');
      XLSX.utils.book_append_sheet(wb, recSheet, 'Recargas');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `report_${startDate || 'all'}_${endDate || 'all'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      exportMessage = 'Excel generado';
    } finally { setTimeout(()=>{ exporting=false; exportMessage=''; }, 1200); }
  }

  async function exportPDF() {
    if (!summary) return;
    if (typeof document === 'undefined') return;
    exporting = true; exportMessage = 'Generando PDF...';
    try {
      const jsPDF = await import('jspdf');
      const PDF = (jsPDF as any).jsPDF;
  const pdf = new PDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;
  // Header using built-in Helvetica for predictable rendering
  pdf.setFont('helvetica');
  pdf.setFontSize(18);
  pdf.setTextColor(53,82,140);
  // Title on its own line
  pdf.text('Reporte InterPOS', margin, y);
  y += 18;
  // Range on the line below (simple 'A - B' format, no 'Rango:')
  pdf.setFontSize(11);
  pdf.setTextColor(100);
  const rangeLabel = displayRange(appliedStart || startDate, appliedEnd || endDate);
  pdf.text(rangeLabel, margin, y);
  y += 22;

      // Prepare data
      const salesByMethod = summary.summary.salesByMethod || {};
      const recargasByMethod = summary.summary.recargasByMethod || {};
      // Sorted arrays (desc by value)
      const salesEntries = Object.entries(salesByMethod).map(([k,v]) => ({ metodo: k, valor: Number(v||0) })).sort((a,b)=> b.valor - a.valor);
      const recEntries = Object.entries(recargasByMethod).map(([k,v]) => ({ metodo: k, valor: Number(v||0) })).sort((a,b)=> b.valor - a.valor);

      // Summary cards (draw as rectangles with text)
      const cardW = (pageWidth - margin*2 - 16) / 3; // three cards in a row
      const cardH = 60;
      const cardY = y;
      const cardPad = 10;
      const cardValues = [
        { title: 'Ventas totales', value: summary.summary.totalSales || 0, color: [53,82,140] },
        { title: 'Ventas en efectivo', value: summary.summary.totalSalesCash || 0, color: [34,197,94] },
        { title: 'Recargas totales', value: summary.summary.totalRecargas || 0, color: [16,163,127] }
      ];
      for (let i=0;i<cardValues.length;i++) {
        const cx = margin + (cardW + 8) * i;
        pdf.setDrawColor(235); pdf.setFillColor(255,255,255); pdf.rect(cx, cardY, cardW, cardH, 'F');
        // small colored stripe
        pdf.setFillColor(...cardValues[i].color); pdf.rect(cx, cardY, 8, cardH, 'F');
        pdf.setFontSize(10); pdf.setTextColor(100); pdf.text(cardValues[i].title, cx + cardPad + 4, cardY + 18);
        pdf.setFontSize(16); pdf.setTextColor(0); pdf.text(formatCurrency(cardValues[i].value), cx + cardPad + 4, cardY + 40);
      }
      y += cardH + 18;

      // Helper to add a table with pagination
      const addTable = (title: string, rows: Array<{metodo:string,valor:number}>) => {
        pdf.setFontSize(14); pdf.setTextColor(0); pdf.text(title, margin, y);
        y += 18;
        const colMetodoX = margin;
        const colValorX = pageWidth - margin - 120;
        pdf.setFontSize(10); pdf.setTextColor(100);
        // header
        pdf.text('Método', colMetodoX, y);
        pdf.text('Valor', colValorX, y);
        y += 12;
        pdf.setDrawColor(230); pdf.setLineWidth(0.5);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 8;

        for (const r of rows) {
          // handle page break
          if (y > pageHeight - margin - 40) { pdf.addPage(); y = margin; }
          pdf.setFontSize(11); pdf.setTextColor(60);
          const metodo = r.metodo.length>56 ? r.metodo.slice(0,53)+ '...' : r.metodo;
          pdf.text(metodo, colMetodoX, y, { maxWidth: colValorX - colMetodoX - 8 });
          pdf.setFontSize(11); pdf.setTextColor(0);
          pdf.text(formatCurrency(r.valor), colValorX, y);
          y += 16;
        }
        y += 12;
      };

      // Add tables sorted
  addTable('Ventas', salesEntries);
  addTable('Recargas', recEntries);

  // Add top products table if available
  if (summary.summary.topProducts && summary.summary.topProducts.length) {
    // small helper to add product table
    const addProductsTable = (title: string, rows: Array<{product:string,quantity:number}>) => {
      pdf.setFontSize(14); pdf.setTextColor(0); pdf.text(title, margin, y);
      y += 18;
      const colProdX = margin;
      const colQtyX = pageWidth - margin - 80;
      pdf.setFontSize(10); pdf.setTextColor(100);
      pdf.text('Producto', colProdX, y);
      pdf.text('Cantidad', colQtyX, y);
      y += 12;
      pdf.setDrawColor(230); pdf.setLineWidth(0.5);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 8;
      for (const r of rows) {
        if (y > pageHeight - margin - 40) { pdf.addPage(); y = margin; }
        pdf.setFontSize(11); pdf.setTextColor(60);
        const prod = r.product.length>56 ? r.product.slice(0,53)+ '...' : r.product;
        pdf.text(prod, colProdX, y, { maxWidth: colQtyX - colProdX - 8 });
        pdf.setFontSize(11); pdf.setTextColor(0);
        pdf.text(String(r.quantity), colQtyX, y);
        y += 16;
      }
      y += 12;
    };

    addProductsTable('Top productos', summary.summary.topProducts);
  }

      // Small bar charts at the end (compact)
      const drawCompactBar = (rows: Array<{metodo:string,valor:number}>, title: string) => {
        const keys = rows.map(r=>r.metodo);
        const values = rows.map(r=>r.valor);
        const maxVal = Math.max(...values, 1);
        pdf.setFontSize(14); pdf.setTextColor(0); pdf.text(title, margin, y);
        y += 18;
        const chartX = margin; const chartWidth = pageWidth - margin*2; const chartHeight = Math.min(140, pageHeight - y - margin - 20);
        const gap = 8;
        const barWidth = Math.max(12, (chartWidth - gap * (keys.length - 1)) / Math.max(1, keys.length));
        let bx = chartX;
        for (let i=0;i<keys.length;i++) {
          const v = values[i];
          const h = (v / maxVal) * (chartHeight - 4);
          pdf.setFillColor(53,82,140); pdf.rect(bx, y + (chartHeight - h), barWidth, h, 'F');
          // label
          pdf.setFontSize(8); pdf.setTextColor(80);
          const label = keys[i].length>20? keys[i].slice(0,17)+'...':keys[i];
          pdf.text(label, bx, y + chartHeight + 12, { maxWidth: barWidth });
          bx += barWidth + gap;
        }
        y += chartHeight + 24;
      };

      // draw compact charts but only if space
      if (y < pageHeight - 200) drawCompactBar(salesEntries.slice(0,8), 'Ventas - Top métodos');
      if (y < pageHeight - 140) drawCompactBar(recEntries.slice(0,8), 'Recargas - Top métodos');

      // Footer: generation datetime at bottom-right
      try {
        const genDate = new Date();
        let genStr = '';
        try {
          genStr = genDate.toLocaleString('es-CO', { timeZone: TIMEZONE });
        } catch (e) {
          genStr = genDate.toLocaleString();
        }
        pdf.setFontSize(10);
        pdf.setTextColor(120);
        // place the text at the bottom-right margin
        pdf.text(`Generado: ${genStr}`, pageWidth - margin, pageHeight - 12, { align: 'right' });
      } catch (e) {
        // ignore footer errors
      }

  // Build filename using the same A - B display
  const fnameA = fileRangeLabel(startDate, endDate);
  const fnameB = null;
  // Replace any characters that could be problematic in filenames
  const safe = String(fnameA).replace(/[\\/:*?"<>|]/g, '_');
  pdf.save(`Reporte InterPOS (${safe}).pdf`);
      exportMessage = 'PDF generado';
    } finally { setTimeout(()=>{ exporting=false; exportMessage=''; }, 1200); }
  }


</script>

<svelte:head>
  <title>Reportes | {siteName}</title>
  <!-- Load Nunito for charts and headings -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700&display=swap" rel="stylesheet">
</svelte:head>

<div class="max-w-4xl mx-auto p-4 reports-root">
  <div class="text-center header-space">
  <h1 class="text-4xl font-bold text-[#35528C] mb-1 font-sans s-xNGq_AHMpqrL">Reportes</h1>
    <p class="text-lg text-[#35528C]/80 font-sans max-w-2xl mx-auto s-WmfxB9smyTUP mb-2">Resumen general de la actividad. Usa los filtros para ajustar el periodo.</p>
  </div>

  

  <div class="card p-4 mb-4 filters-container">
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
      <div>
        <label for="startDate" class="block text-sm font-medium text-gray-700">Fecha inicio</label>
  <input id="startDate" type="date" bind:value={startDate} max={endDate || today} class="input-field mt-1 w-full" on:change={onStartDateChange} on:input={onStartDateInput} />
      </div>
      <div>
        <label for="endDate" class="block text-sm font-medium text-gray-700">Fecha fin</label>
  <input id="endDate" type="date" bind:value={endDate} min={startDate || ''} max={today} class="input-field mt-1 w-full" on:change={onEndDateChange} on:input={onEndDateInput} />
      </div>
      <div class="flex gap-2 items-center">
  <button class="btn-primary" on:click={handleApplyClick} disabled={loading}>
          {#if loading}
            Cargando...
          {:else}
            Aplicar
          {/if}
        </button>
        <button class="btn-secondary" on:click={() => applyRange('','')}>
          Limpiar
        </button>
      </div>
    </div>
      <div class="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="flex items-center gap-2">
  <div class="preset-group flex gap-2 mt-3 flex-wrap">
        {#each presets as preset}
          <button
            class="preset-btn"
            class:active={isPresetActive(preset)}
            type="button"
            aria-pressed={isPresetActive(preset)}
            aria-current={isPresetActive(preset) ? 'true' : 'false'}
            on:click={() => {
              const range = preset.getRange();
              applyRange(range.start || '', range.end || '');
            }}
          >{preset.label}</button>
        {/each}
      </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="relative">
            <button class="btn-export relative inline-flex items-center p-2 export-button" aria-haspopup="true" aria-expanded={showExportMenu} aria-label={selectedExportFormat ? `Exportar como ${selectedExportFormat}` : 'Exportar'} title={selectedExportFormat ? `Exportar como ${selectedExportFormat}` : 'Exportar'} on:click|stopPropagation={() => toggleExportMenu()}>
              <!-- clearer download icon (icon-only button) -->
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v12" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 11l4 4 4-4" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21H3" />
              </svg>
              {#if selectedExportFormat === 'PDF'}
                <span class="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary-700 border-2 border-white" aria-hidden="true" title="PDF seleccionado"></span>
              {:else if selectedExportFormat === 'Excel'}
                <span class="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-600 border-2 border-white" aria-hidden="true" title="Excel seleccionado"></span>
              {/if}
            </button>
            {#if showExportMenu}
              <div class="export-popover" role="menu" aria-label="Opciones de exportación" tabindex="-1" on:mouseleave={() => closeExportMenu()}>
                <button
                  class="export-item flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 hover:border hover:border-gray-300 focus:bg-gray-100 focus:border focus:border-gray-300 w-full text-left transition-all duration-200"
                  class:font-semibold={selectedExportFormat === 'PDF'}
                  class:bg-blue-50={selectedExportFormat === 'PDF'}
                  class:border-2={selectedExportFormat === 'PDF'}
                  class:border-primary-700={selectedExportFormat === 'PDF'}
                  aria-pressed={selectedExportFormat === 'PDF'}
                  title="Exportar PDF"
                  on:click={() => { selectedExportFormat = 'PDF'; exportPDF(); closeExportMenu(); }}
                  disabled={!summary || exporting}
                >
                  <span class="ml-1">PDF</span>
                </button>
                <button
                  class="export-item flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 hover:border hover:border-gray-300 focus:bg-gray-100 focus:border focus:border-gray-300 w-full text-left transition-all duration-200"
                  class:font-semibold={selectedExportFormat === 'Excel'}
                  class:bg-green-50={selectedExportFormat === 'Excel'}
                  class:border-2={selectedExportFormat === 'Excel'}
                  class:border-green-600={selectedExportFormat === 'Excel'}
                  aria-pressed={selectedExportFormat === 'Excel'}
                  title="Exportar Excel"
                  on:click={() => { selectedExportFormat = 'Excel'; exportExcel(); closeExportMenu(); }}
                  disabled={!summary || exporting}
                >
                  <span class="ml-1">Excel</span>
                </button>
              </div>
            {/if}
          </div>
          {#if exportMessage}
            <div class="text-sm text-gray-600">{exportMessage}</div>
          {/if}
        </div>
      </div>
      <!-- Consolidated presets and export control are rendered above (programmatic presets) -->
  </div>


  {#if error}
    <div class="mb-4 p-3 rounded bg-red-50 text-red-700">{error}</div>
  {/if}

  {#if summary?.summary}
  <div class="section-header">
    <div class="title-wrap">
      <h3 class="section-title">Ventas <span class="section-meta">({displayRange(appliedStart || startDate, appliedEnd || endDate)})</span></h3>
    </div>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <!-- Left column: stacked summary cards (50/50 on md) -->
      <div>
        <div class="flex flex-col gap-4">
          <div class="p-4 bg-white rounded-lg shadow-sm">
            <div class="summary-card">
              <p class="text-sm text-gray-500">Ventas totales 📊</p>
                <p class="text-2xl font-semibold">{formatCurrency(derivedTotalSales)}</p>
                <p class="text-sm text-gray-400" class:text-base={isZero(derivedCountsOrders || summary.summary.counts.orders)} class:font-medium={isZero(derivedCountsOrders || summary.summary.counts.orders)}>{txLabel(derivedCountsOrders || summary.summary.counts.orders)}</p>
            </div>
          </div>
          <div class="p-4 bg-white rounded-lg shadow-sm">
            <div class="summary-card">
              <p class="text-sm text-gray-500">Ventas en saldo 💳</p>
                <p class="text-2xl font-semibold">{formatCurrency(derivedTotalSalesSaldo || totalSalesSaldo())}</p>
                <p class="text-sm text-gray-400" class:text-base={isZero((summary.summary.salesCountsByMethod && Object.entries(summary.summary.salesCountsByMethod).reduce((s,[k,v]) => k.toLowerCase().includes('saldo') ? s+Number(v||0) : s, 0)) || 0)} class:font-medium={isZero((summary.summary.salesCountsByMethod && Object.entries(summary.summary.salesCountsByMethod).reduce((s,[k,v]) => k.toLowerCase().includes('saldo') ? s+Number(v||0) : s, 0)) || 0)}>{txLabel((summary.summary.salesCountsByMethod && Object.entries(summary.summary.salesCountsByMethod).reduce((s,[k,v]) => k.toLowerCase().includes('saldo') ? s+Number(v||0) : s, 0)) || 0)}</p>
            </div>
          </div>
          <div class="p-4 bg-white rounded-lg shadow-sm">
            <div class="summary-card">
              <p class="text-sm text-gray-500">Ventas en efectivo 💵</p>
                <p class="text-2xl font-semibold">{formatCurrency(derivedTotalSalesCash)}</p>
                <p class="text-sm text-gray-400" class:text-base={isZero((summary.summary.salesCountsByMethod && Object.entries(summary.summary.salesCountsByMethod).reduce((s,[k,v]) => k.toLowerCase().includes('efectivo') ? s+Number(v||0) : s, 0)) || 0)} class:font-medium={isZero((summary.summary.salesCountsByMethod && Object.entries(summary.summary.salesCountsByMethod).reduce((s,[k,v]) => k.toLowerCase().includes('efectivo') ? s+Number(v||0) : s, 0)) || 0)}>{txLabel((summary.summary.salesCountsByMethod && Object.entries(summary.summary.salesCountsByMethod).reduce((s,[k,v]) => k.toLowerCase().includes('efectivo') ? s+Number(v||0) : s, 0)) || 0)}</p>
            </div>
          </div>
        </div>
      </div>
      <!-- Right column: sales chart -->
      <div class="flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-sm">
        <canvas bind:this={salesCanvas} style="max-height:320px; width:100%"></canvas>
      </div>

    </div>

    <!-- Recargas: sección separadora + left stacked summaries, right chart (50/50) -->
  <!-- Recargas: sección separadora + left stacked summaries, right chart (50/50) -->
  <div class="section-header">
    <div class="title-wrap">
      <h3 class="section-title">Recargas <span class="section-meta">({displayRange(appliedStart || startDate, appliedEnd || endDate)})</span></h3>
    </div>
  </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <div class="flex flex-col gap-4">
          <div class="p-4 bg-white rounded-lg shadow-sm">
            <div class="summary-card">
              <p class="text-sm text-gray-500">Recargas totales 🔁</p>
              <p class="text-2xl font-semibold">{formatCurrency(derivedTotalRecargas)}</p>
              <p class="{countClass(displayRecargasCount)}">{txLabel(displayRecargasCount)}</p>
            </div>
          </div>
          <div class="p-4 bg-white rounded-lg shadow-sm">
            <div class="summary-card">
              <p class="text-sm text-gray-500">Recargas en efectivo 💵</p>
              <p class="text-2xl font-semibold">{formatCurrency(derivedRecargasCash)}</p>
              <p class="{countClass(displayRecargasCashCount)}">{txLabel(displayRecargasCashCount)}</p>
            </div>
          </div>
          <div class="p-4 bg-white rounded-lg shadow-sm">
            <div class="summary-card">
              <p class="text-sm text-gray-500">Recargas por operación interna 🔧</p>
              <p class="text-2xl font-semibold">{formatCurrency(derivedRecargasInternal)}</p>
              <p class="{countClass(displayRecargasInternalCount)}">{txLabel(displayRecargasInternalCount)}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-sm">
        <canvas bind:this={recargasCanvas} style="max-height:320px; width:100%"></canvas>
      </div>
    </div>

    

    <!-- Top productos -->
  <div class="section-header mt-3">
      <div class="title-wrap">
  <h3 class="section-title">Top productos <span class="section-meta">({displayRange(appliedStart || startDate, appliedEnd || endDate)} • {totalTopDistinct} productos, {totalTopUnits.toLocaleString('es-CO')} unidades)</span></h3>
      </div>
    </div>
  <div class="card p-4 mb-4">
      {#if topProductsList && topProductsList.length}
        <div class="top-products-list">
          {#each topProductsList as p, i}
            <div class="tp-row">
                <div class="tp-left">
                <div class="tp-rank">{i+1}</div>
                <div class="tp-name" title={cleanProductName(p.product)}>{cleanProductName(p.product)}</div>
              </div>
              <div class="tp-right" aria-label={`Cantidad vendida: ${Number(p.quantity).toLocaleString('es-CO')} ${Number(p.quantity) === 1 ? 'unidad' : 'unidades'}`} title={`Cantidad: ${Number(p.quantity).toLocaleString('es-CO')} ${Number(p.quantity) === 1 ? 'unidad' : 'unidades'}`}>
                <div class="tp-simple-circle" role="img" aria-label={`Cantidad ${Number(p.quantity).toLocaleString('es-CO')} ${Number(p.quantity) === 1 ? 'unidad' : 'unidades'}`} title={`${Number(p.quantity).toLocaleString('es-CO')} ${Number(p.quantity) === 1 ? 'unidad' : 'unidades'}`}>
                  <div class="tp-simple-num" aria-hidden="true">{Number(p.quantity).toLocaleString('es-CO')}</div>
                  <div class="tp-simple-suffix-short" aria-hidden="true">und</div>
                  <div class="tp-simple-suffix-full" aria-hidden="true">{Number(p.quantity) === 1 ? 'unidad' : 'unidades'}</div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-sm text-gray-500">No hay datos de productos para este rango.</p>
      {/if}
    </div>

    
  {/if}

  </div>


<style>
  .input-field { padding: .5rem .75rem; border: 1px solid #e5e7eb; border-radius: .5rem; }
  /* Force consistent background and text color for date controls (some browsers
    apply different native styling to date inputs or when min/max make them
    appear invalid). These rules keep startDate and endDate visually identical. */
  .input-field { background: #fff; color: inherit; }
  /* Remove native invalid box-shadow that some browsers add for out-of-range dates */
  .input-field:invalid { box-shadow: none; }
  /* Ensure the inner editable part of webkit date inputs inherits color */
  input[type="date"]::-webkit-datetime-edit, input[type="date"]::-webkit-datetime-edit-fields-wrapper { color: inherit; }
  .card { background: white; border-radius: var(--radius-lg); box-shadow: 0 6px 18px rgba(16,24,40,0.04); }
  /* extra spacing for the filters container to separate it from following content */
  .filters-container { margin-bottom: 2.25rem; }
  .btn-primary { background: #35528C; color: white; padding: .5rem 1rem; border-radius: var(--radius-md); }
  .btn-secondary { background: #f3f4f6; color: #111827; padding: .5rem 1rem; border-radius: var(--radius-md); }
  /* Preset buttons: non-active have a subtle border so each button is distinguished; active keeps only background */
  .preset-group .preset-btn {
    background: transparent;
    border: 1px solid #e5e7eb;
    padding: .35rem .6rem;
    border-radius: .5rem;
    font-size: .85rem;
    box-shadow: none !important;
    transform: none !important;
    transition: background-color .12s ease;
  }
  /* Non-active hover: subtle background to indicate interactivity */
  .preset-group .preset-btn:not(.active):hover {
    background: rgba(53,82,140,0.04);
  }
  /* Active preset: only background (no border or shadow) */
  .preset-group .preset-btn.active {
    background: #35528C !important;
    color: white !important;
    border: none !important;
    box-shadow: none !important;
    transform: none !important;
  }
  /* Only show focus ring for keyboard users */
  .preset-group .preset-btn:focus-visible {
    outline: 3px solid rgba(53,82,140,0.22);
    outline-offset: 2px;
  }
  .btn-export { background: #f3f4f6; border-radius: .5rem; }
  .export-popover { position: absolute; right: 0; top: calc(100% + 6px); background: white; border: 1px solid #e5e7eb; padding: .5rem; border-radius: .5rem; box-shadow: 0 6px 18px rgba(16,24,40,0.08); z-index: 50; }
  .export-item { display:block; width:100%; text-align:left; padding: .4rem .6rem; background:transparent; border: none; cursor: pointer; }
  .export-item:disabled { opacity: .5; cursor: not-allowed; }
  /* Custom adjustments requested */
  .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
  .text-\[\#35528C\]\/80 { color: rgb(53 82 140 / 0.8); }
  .section-title {
    font-size: 1.125rem; /* small increase */
    font-weight: 700;
    color: #2b4a88; /* slightly deeper blue */
    padding-left: 0.6rem;
    border-left: 3px solid rgba(53,82,140,0.12);
    margin-top: 0.6rem; /* a bit more space above */
    margin-bottom: 1rem; /* increased separation */
  }
  .section-header { display:flex; justify-content:space-between; align-items:center; gap:1rem; }
  /* Add vertical spacing above and below section headers */
  .section-header { margin-top: 1.25rem; margin-bottom: 1.25rem; }
  .section-header .title-wrap { display:block; }
  /* section-sub removed: details are shown inline in .section-meta */

  /* On wider screens keep title and sub on one line, truncate subtitle when needed */
  @media (min-width: 768px) {
    .section-header .title-wrap { display:flex; align-items:baseline; gap:0.75rem; }
    .section-title { margin-bottom:0; padding-left:0.6rem; }
  /* subtitle moved to .section-meta; no separate .section-sub needed */
    .section-meta { font-size:0.9rem; color:#6b7f9f; margin-left:0.25rem; }
  }
  .summary-card { padding: 0; }
  .summary-card p { margin: 0.15rem 0; }
  .summary-card .text-2xl { margin-top: 0.35rem; }
  /* stripe-* styles removed from UI; kept for PDF generation only */

  /* Top products styles */
  .top-products-list { display:flex; flex-direction:column; gap:0.5rem; }
  .tp-row { display:flex; justify-content:space-between; align-items:center; gap:0.75rem; }
  .tp-left { display:flex; align-items:center; gap:0.5rem; min-width:0; }
  .tp-rank { width:1.6rem; height:1.6rem; display:flex; align-items:center; justify-content:center; background:#f3f4f6; border-radius:0.375rem; font-weight:600; color:#374151; }
  .tp-name { font-weight:600; color:#111827; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .tp-right { display:flex; align-items:center; gap:0.5rem; min-width:4.5rem; }
  /* Simple circular badge for quantity */
  .tp-simple-circle { background: rgba(28,67,146,0.8); color: white; width:40px; height:40px; border-radius:999px; display:flex; flex-direction:column; align-items:center; justify-content:center; font-weight:700; }
  .tp-simple-num { font-size:0.85rem; line-height:1; }
  /* Short suffix visible by default; full word hidden until hover/focus */
  .tp-simple-suffix-short { font-size:0.65rem; opacity:0.95; margin-top:1px; }
  /* full form kept hidden visually; accessibility provided via container's title/aria-label */
  .tp-simple-suffix-full { display:none; font-size:0.65rem; opacity:0.95; margin-top:1px; }
  /* media helper removed (unused) */
  /* removed dashboard menu styles */
  /* Ensure this page's content sits below the topbar to avoid overlap */
  /* add 20px extra so header doesn't touch content (un "tris más" de margen) */
  .reports-root { padding-top: calc(var(--topbar-h) + var(--topbar-gap) + 20px); }
</style>
