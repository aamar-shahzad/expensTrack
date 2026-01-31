import * as Y from 'yjs';
import { getDB } from '@/db/schema';
import type { Expense, Person, Payment } from '@/types';

const MIGRATION_KEY = 'yjs-migration-complete';

/**
 * Check if migration has already been completed
 */
export function isMigrationComplete(): boolean {
  return localStorage.getItem(MIGRATION_KEY) === 'true';
}

/**
 * Mark migration as complete
 */
export function markMigrationComplete(): void {
  localStorage.setItem(MIGRATION_KEY, 'true');
}

/**
 * Migrate existing Dexie data to Yjs document
 * This should be called once when the app first loads with Yjs
 */
export async function migrateToYjs(ydoc: Y.Doc): Promise<{
  success: boolean;
  migratedExpenses: number;
  migratedPeople: number;
  migratedPayments: number;
  error?: string;
}> {
  // Skip if already migrated
  if (isMigrationComplete()) {
    console.log('[Migration] Already migrated, skipping');
    return {
      success: true,
      migratedExpenses: 0,
      migratedPeople: 0,
      migratedPayments: 0
    };
  }

  try {
    console.log('[Migration] Starting migration from Dexie to Yjs...');
    
    const db = getDB();
    
    // Load all data from Dexie
    const [expenses, people, payments] = await Promise.all([
      db.expenses.toArray(),
      db.people.toArray(),
      db.payments.toArray()
    ]);

    console.log(`[Migration] Found ${expenses.length} expenses, ${people.length} people, ${payments.length} payments`);

    // Get Yjs arrays
    const yExpenses = ydoc.getArray<Expense>('expenses');
    const yPeople = ydoc.getArray<Person>('people');
    const yPayments = ydoc.getArray<Payment>('payments');

    // Check if Yjs already has data (from another device sync)
    const existingExpenses = yExpenses.toArray();
    const existingPeople = yPeople.toArray();
    const existingPayments = yPayments.toArray();

    // Create sets of existing syncIds to avoid duplicates
    const existingExpenseSyncIds = new Set(existingExpenses.map(e => e.syncId));
    const existingPeopleSyncIds = new Set(existingPeople.map(p => p.syncId));
    const existingPaymentSyncIds = new Set(existingPayments.map(p => p.syncId));

    // Filter out items that already exist in Yjs
    const newExpenses = expenses.filter(e => !existingExpenseSyncIds.has(e.syncId));
    const newPeople = people.filter(p => !existingPeopleSyncIds.has(p.syncId));
    const newPayments = payments.filter(p => !existingPaymentSyncIds.has(p.syncId));

    console.log(`[Migration] New items to migrate: ${newExpenses.length} expenses, ${newPeople.length} people, ${newPayments.length} payments`);

    // Migrate in a single transaction for atomicity
    ydoc.transact(() => {
      if (newExpenses.length > 0) {
        yExpenses.push(newExpenses);
      }
      if (newPeople.length > 0) {
        yPeople.push(newPeople);
      }
      if (newPayments.length > 0) {
        yPayments.push(newPayments);
      }
    });

    // Mark migration as complete
    markMigrationComplete();

    console.log('[Migration] Migration complete!');

    return {
      success: true,
      migratedExpenses: newExpenses.length,
      migratedPeople: newPeople.length,
      migratedPayments: newPayments.length
    };
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    return {
      success: false,
      migratedExpenses: 0,
      migratedPeople: 0,
      migratedPayments: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Reset migration status (for testing/debugging)
 */
export function resetMigration(): void {
  localStorage.removeItem(MIGRATION_KEY);
  console.log('[Migration] Migration status reset');
}

/**
 * Export Yjs data back to a format that can be imported
 */
export function exportYjsData(ydoc: Y.Doc): {
  expenses: Expense[];
  people: Person[];
  payments: Payment[];
} {
  const yExpenses = ydoc.getArray<Expense>('expenses');
  const yPeople = ydoc.getArray<Person>('people');
  const yPayments = ydoc.getArray<Payment>('payments');

  return {
    expenses: yExpenses.toArray(),
    people: yPeople.toArray(),
    payments: yPayments.toArray()
  };
}
