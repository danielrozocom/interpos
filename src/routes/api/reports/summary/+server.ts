import type { RequestHandler } from '@sveltejs/kit';
import { sbServer } from '$lib/supabase';
import { fromFlexible } from '$lib/dbHelpers';

function parseNumberCell(cell: any) {
  if (cell === undefined || cell === null) return 0;
  const s = String(cell).replace(/[$,\s]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function inRange(dateISO: string, start?: string | null, end?: string | null) {
  if (!dateISO) return false;
  // Normalize to date-only (YYYY-MM-DD) to make start/end inclusive and avoid timezone issues
  // If the caller already provided a YYYY-MM-DD string, use it directly
  let day: string;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    day = dateISO;
  } else {
    const d = new Date(dateISO);
    if (isNaN(d.getTime())) return false;
    day = d.toISOString().split('T')[0];
  }
  if (start) {
    if (day < start) return false;
  }
  if (end) {
    if (day > end) return false;
  }
  return true;
}

// Helper to normalize spreadsheet date/time cells to local YYYY-MM-DD (avoids UTC shifts)
function normalizeToYMD(dateCell: any, timeCell: any) {
  const dateStr = dateCell || '';
  const timeStr = timeCell || '';
  // If already in ISO date-only format
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return String(dateStr);
  // Try parsing by combining date and time as local datetime
  const combined = (String(dateStr) + ' ' + String(timeStr)).trim();
  const d = new Date(combined);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  // Fallback: try to extract yyyy-mm-dd from the cell
  const m = String(dateStr).match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return '';
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    const startDate = url.searchParams.get('startDate'); // ISO strings accepted
    const endDate = url.searchParams.get('endDate');

    // Read Orders from Supabase Transactions_Orders table (flexible names)
    let ordersRows: any[] = [];
    try {
      const ordersSource = await fromFlexible('Transactions_Orders');
      const { data: _ordersRows, error: ordersErr } = await ordersSource.from().select('Date,Time,OrderID,UserID,Name,Quantity,Method,Products');
      if (ordersErr) throw ordersErr;
      ordersRows = _ordersRows || [];
    } catch (ordersErr) {
      console.error('Error fetching orders for reports:', ordersErr);
      return new Response(JSON.stringify({ success: false, error: 'Error fetching orders' }), { status: 500 });
    }
    const orders = (ordersRows || []).map((row: any) => {
      const date = row.Date || '';
      const time = row.Time || '';
      const day = normalizeToYMD(date, time);
      let iso = '';
      try { iso = new Date(`${date}T${time}`).toISOString(); } catch (e) { iso = date; }
      return {
        date: iso,
        day,
        dateOnly: date,
        timeOnly: time,
        orderID: row.OrderID || '',
        userID: row.UserID || '',
        name: row.Name || '',
        quantity: parseNumberCell(row.Quantity),
        method: row.Method || '',
        products: row.Products || ''
      };
    }).filter(o => !startDate || inRange(o.day, startDate, endDate));

    // Read balance transactions from Supabase Transactions_Balance (flexible names)
    let balanceRows: any[] = [];
    try {
      let balanceSource;
      try {
        balanceSource = await fromFlexible('Transactions_Balance');
      } catch (inner) {
        console.warn('fromFlexible failed for Transactions_Balance, trying "Transactions - Balance"', inner);
        balanceSource = await fromFlexible('Transactions - Balance');
      }
      const { data: _balanceRows, error: balanceErr } = await balanceSource.from().select('Date,Time,UserID,Name,Quantity,PrevBalance,NewBalance,Method,Observations');
      if (balanceErr) throw balanceErr;
      balanceRows = _balanceRows || [];
    } catch (balanceErr) {
      console.error('Error fetching balance transactions for reports:', balanceErr);
      return new Response(JSON.stringify({ success: false, error: 'Error fetching balance transactions' }), { status: 500 });
    }
    const recargas = (balanceRows || []).map((row: any) => {
      const date = row.Date || '';
      const time = row.Time || '';
      const day = normalizeToYMD(date, time);
      let iso = '';
      try { iso = new Date(`${date}T${time}`).toISOString(); } catch (e) { iso = date; }
      return {
        date: iso,
        day,
        dateOnly: date,
        timeOnly: time,
        userID: row.UserID || '',
        name: row.Name || '',
        quantity: parseNumberCell(row.Quantity),
        prevBalance: parseNumberCell(row.PrevBalance),
        newBalance: parseNumberCell(row.NewBalance),
        method: row.Method || '',
        observation: row.Observations || ''
      };
    }).filter(r => !startDate || inRange(r.day, startDate, endDate));

    // Aggregate sales by payment method (from orders)
    const salesByMethod: Record<string, number> = {};
    const salesCountsByMethod: Record<string, number> = {};
    let totalSales = 0;
    let totalSalesCash = 0;
    for (const o of orders) {
      const m = o.method || 'Unknown';
      salesByMethod[m] = (salesByMethod[m] || 0) + o.quantity;
      // Count transactions (orders) per method (each order counts once)
      salesCountsByMethod[m] = (salesCountsByMethod[m] || 0) + 1;
      totalSales += o.quantity;
      if (m.toLowerCase().includes('efectivo')) totalSalesCash += o.quantity;
    }

    // Aggregate top products from orders.products field
    // Use a normalization function to avoid duplicates caused by IDs, prices or trailing qty markers
    function normalizeForKey(s: string) {
      if (!s) return '';
      let t = String(s).toLowerCase();
      // remove content in parentheses e.g. (ID: 25)
      t = t.replace(/\([^)]*\)/g, ' ');
      // remove id:123 or id: 123
      t = t.replace(/\bid\s*:?\s*\d+\b/gi, ' ');
      // remove quantity markers like x1, x 1, ×1
      t = t.replace(/\b[x×]\s*\d+\b/gi, ' ');
      // remove price patterns like - $8.000 or - 8.000 or $8.000
      t = t.replace(/[-–—]\s*\$?\s*[\d,.]+/g, ' ');
      t = t.replace(/\$\s*[\d,.]+/g, ' ');
  // remove punctuation characters that are not letters/numbers/space
  // use ASCII-safe fallback to avoid Unicode property escapes
  t = t.replace(/[^0-9A-Za-z ]+/g, ' ');
  // decompose accents then remove diacritics (combining marks)
  t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      // collapse spaces and trim
      t = t.replace(/\s{2,}/g, ' ').trim();
      return t;
    }

    const prodMap = new Map<string, { display: string, qty: number }>();
    for (const o of orders) {
      const prodField = String(o.products || '').trim();
      if (!prodField) continue;
      const parts = prodField.split(/[,;|\n]+/).map(p => p.trim()).filter(Boolean);

      if (parts.length === 1) {
        const part = parts[0];
        // default to 1 unit unless we can parse an explicit quantity
        let qty = 1;
        const m1 = part.match(/^(.*)\b[x×]\s*(\d+)$/i);
        const m2 = part.match(/^(.*)\((\d+)\)\s*$/i);
        const m3 = part.match(/^(.*)\-\s*(\d+)$/i);
        if (m1) qty = parseInt(m1[2], 10) || qty;
        else if (m2) qty = parseInt(m2[2], 10) || qty;
        else if (m3) qty = parseInt(m3[2], 10) || qty;
        else {
          // fallback: use o.quantity only if it looks like a plausible unit count
          const oq = Number(o.quantity || 0);
          const looksLikeCount = Number.isInteger(oq) && oq > 0 && oq <= 1000;
          const hasPriceMarker = /\$|\d+[.,]\d{3}|[-–—]/.test(part);
          if (looksLikeCount && !hasPriceMarker) qty = oq;
        }

        const key = normalizeForKey(part);
        if (!key) continue;
  // build a consistent display: clean then Title Case, remove diacritics for consistency
  let rawDisplay = part.replace(/\([^)]*\)/g, '').replace(/\bID\s*:?\s*\d+\b/gi, '').replace(/\b[x×]\s*\d+\b/gi, '').replace(/[-–—]\s*\$?\s*[\d,.]+/g, '').replace(/\$\s*[\d,.]+/g, '').replace(/\s{2,}/g, ' ').trim();
  rawDisplay = rawDisplay.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const display = rawDisplay || key;
        const existing = prodMap.get(key);
        if (existing) existing.qty += Number(qty) || 0;
        else prodMap.set(key, { display, qty: Number(qty) || 0 });
        continue;
      }

      for (const part of parts) {
        let qty: number | null = null;
        const m1 = part.match(/^(.*)\b[x×]\s*(\d+)$/i);
        const m2 = part.match(/^(.*)\((\d+)\)\s*$/i);
        const m3 = part.match(/^(.*)\-\s*(\d+)$/i);
        const m4 = part.match(/^(.*)\s+(\d+)$/i);
        if (m1) { qty = parseInt(m1[2], 10) || 1; }
        else if (m2) { qty = parseInt(m2[2], 10) || 1; }
        else if (m3) { qty = parseInt(m3[2], 10) || 1; }
        else if (m4) {
          const possibleQty = parseInt(m4[2], 10);
          if (!isNaN(possibleQty)) qty = possibleQty;
        }
        const addQty = qty !== null ? qty : 1;
        const key = normalizeForKey(part);
        if (!key) continue;
  let rawDisplay = part.replace(/\([^)]*\)/g, '').replace(/\bID\s*:?\s*\d+\b/gi, '').replace(/\b[x×]\s*\d+\b/gi, '').replace(/[-–—]\s*\$?\s*[\d,.]+/g, '').replace(/\$\s*[\d,.]+/g, '').replace(/\s{2,}/g, ' ').trim();
  rawDisplay = rawDisplay.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const display = rawDisplay || key;
        const existing = prodMap.get(key);
        if (existing) existing.qty += addQty;
        else prodMap.set(key, { display, qty: addQty });
      }
    }

    // Build productsCounts and topProducts from map
    const productsCounts: Record<string, number> = {};
    for (const [k, v] of prodMap.entries()) productsCounts[v.display || k] = v.qty;
    const topProducts = Array.from(prodMap.entries()).map(([k, v]) => ({ product: v.display || k, quantity: v.qty })).sort((a,b) => b.quantity - a.quantity).slice(0, 20);

    // Aggregate recargas by method (from recargas)
    const recargasByMethod: Record<string, number> = {};
    let totalRecargas = 0;
    const recargasCountsByMethod: Record<string, number> = {};
    // Only count positive recargas (ignore negative adjustments/consumos)
    for (const r of recargas) {
      const q = Number(r.quantity || 0);
      if (q <= 0) continue; // skip non-positive entries
      const m = r.method || 'Unknown';
      recargasByMethod[m] = (recargasByMethod[m] || 0) + q;
      // count transactions (each recarga row counts as one transaction)
      // normalize common variants to canonical keys
  const nm = String(m || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      let key = m;
      try {
        if (nm.includes('efectivo') || nm.includes('cash')) key = 'Efectivo';
        else if (nm.includes('operacion') || nm.includes('interna') || nm.includes('internal') || nm.includes('operacional') || nm.includes('operación interna')) key = 'Recargas por operación interna 🔧';
        else key = m;
      } catch (e) {
        key = m;
      }
      recargasCountsByMethod[key] = (recargasCountsByMethod[key] || 0) + 1;
      totalRecargas += q;
    }

    return new Response(JSON.stringify({
      success: true,
      summary: {
  totalSales,
  totalSalesCash,
  salesByMethod,
  salesCountsByMethod,
  totalRecargas,
  recargasByMethod,
  recargasCountsByMethod,
  productsCounts,
  topProducts,
        counts: {
          orders: orders.length,
          // counts.recargas should reflect number of positive recarga entries
          recargas: recargas.filter(r => Number(r.quantity || 0) > 0).length
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in reports summary:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
