import { sbServer } from './supabase';
import { TABLE_NAME_OVERRIDES } from './server/config';

type TableTryResult = {
  tableName: string | null;
  error?: any;
};

// Given a base table name like 'Transactions_Orders', try a small set of
// alternative names that sometimes appear in legacy schemas, e.g.
// 'Transactions - Orders' or 'Transactions-Orders' or 'Transactions Orders'.
// Returns the first table name that yields rows (or null if none found).
export async function findExistingTable(baseName: string): Promise<TableTryResult> {
  // Build a comprehensive set of variants by normalizing separators in both directions
  const separators = ['_', ' - ', '-', ' ', ''];
  const tokens = baseName
    .trim()
    // split on common separators (underscore, hyphen, spaced-hyphen, spaces)
    .split(/[ _-]+/)
    .filter(Boolean);

  const variantSet = new Set<string>();

  // 0) Preferred override from config/env - try both the exact name and all possible keys
  const override = TABLE_NAME_OVERRIDES[baseName as keyof typeof TABLE_NAME_OVERRIDES];
  if (override) {
    // Add override with highest priority
    variantSet.add(override);
    variantSet.add(override.toLowerCase());
  }
  
  // Special handling for common table names
  if (baseName.includes('Balance')) {
    variantSet.add('transactions_balance');  // Direct known name
  }
  if (baseName.includes('Orders')) {
    variantSet.add('transactions_orders');   // Direct known name
  }

  // 1) Original forms
  variantSet.add(baseName);
  variantSet.add(baseName.trim());
  variantSet.add(baseName.toLowerCase());

  // 2) Generate joins with all separators
  for (const sep of separators) {
    const joined = tokens.join(sep);
    if (joined) {
      variantSet.add(joined);
      variantSet.add(joined.toLowerCase());
    }
  }

  // 3) Specific replacements from underscore <-> spaced dash and others
  const directReplacements = [
    baseName.replace(/_/g, ' - '),
    baseName.replace(/_/g, '-'),
    baseName.replace(/_/g, ' '),
    baseName.replace(/ - /g, '_'),
    baseName.replace(/ - /g, '-'),
    baseName.replace(/ - /g, ' '),
    baseName.replace(/-/g, '_'),
    baseName.replace(/-/g, ' - '),
    baseName.replace(/-/g, ' '),
    baseName.replace(/ /g, '_'),
    baseName.replace(/ /g, '-'),
    baseName.replace(/ /g, ''),
    baseName.replace(/_/g, ''),
  ];
  for (const v of directReplacements) {
    if (v) {
      variantSet.add(v);
      variantSet.add(v.toLowerCase());
    }
  }

  // Create a stable list preserving insertion order
  const variants = Array.from(variantSet);

  const tried: string[] = [];
  for (const t of variants) {
    tried.push(t);
    try {
      const { data, error } = await sbServer.from(t).select('1').limit(1).maybeSingle();
      if (!error) {
        // found a working table
        return { tableName: t };
      }
      // continue trying other variants
    } catch (e) {
      // Log the specific attempt for debugging, but continue
      console.warn(`[findExistingTable] attempt for '${t}' failed:`, e);
    }
  }

  // Return null and include the list of variants tried for better error messages
  return { tableName: null, error: `No table found for ${baseName}. Tried variants: ${tried.join(', ')}` };
}

// Returns a wrapper that calls sbServer.from(table) with the first working table
export async function fromFlexible(baseName: string) {
  // Direct mapping for known table names
  const directMappings: Record<string, string> = {
    'Transactions_Balance': 'transactions_balance',
    'Transactions - Balance': 'transactions_balance',
    'Transactions_Orders': 'transactions_orders',
    'Transactions - Orders': 'transactions_orders',
  };
  
  // If we have a direct mapping, use it directly
  if (directMappings[baseName]) {
    const tableName = directMappings[baseName];
    console.log(`Using direct mapping: ${baseName} -> ${tableName}`);
    return {
      table: tableName,
      from: (tbl?: string) => sbServer.from(tbl || tableName),
    };
  }
  
  // Fall back to the flexible search
  const found = await findExistingTable(baseName);
  if (!found.tableName) {
    const details = (found as any).error || `Tried variants for ${baseName}`;
    throw new Error(`No table found for ${baseName}. ${details}`);
  }
  return {
    table: found.tableName,
    from: (tbl?: string) => sbServer.from(tbl || (found.tableName as string)),
  };
}

export default { findExistingTable, fromFlexible };
