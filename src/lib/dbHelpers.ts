import { sbServer } from './supabase';

type TableTryResult = {
  tableName: string | null;
  error?: any;
};

// Given a base table name like 'Transactions_Orders', try a small set of
// alternative names that sometimes appear in legacy schemas, e.g.
// 'Transactions - Orders' or 'Transactions-Orders' or 'Transactions Orders'.
// Returns the first table name that yields rows (or null if none found).
export async function findExistingTable(baseName: string): Promise<TableTryResult> {
  const variants = [
    baseName,
    baseName.replace(/_/g, ' - '),
    baseName.replace(/_/g, ' -'),
    baseName.replace(/_/g, '-'),
    baseName.replace(/_/g, ' '),
    baseName.toLowerCase(),
    baseName.replace(/_/g, ''),
  ];

  for (const t of variants) {
    try {
      const { data, error } = await sbServer.from(t).select('1').limit(1).maybeSingle();
      if (!error) {
        // found a working table
        return { tableName: t };
      }
      // If error exists, check if it's the PGRST205 (table not found) and continue
    } catch (e) {
      // ignore and try next variant
    }
  }

  return { tableName: null };
}

// Returns a wrapper that calls sbServer.from(table) with the first working table
export async function fromFlexible(baseName: string) {
  const found = await findExistingTable(baseName);
  if (!found.tableName) {
    throw new Error(`No table found for ${baseName}`);
  }
  return {
    table: found.tableName,
    from: (tbl?: string) => sbServer.from(tbl || found.tableName as string),
  };
}

export default { findExistingTable, fromFlexible };
