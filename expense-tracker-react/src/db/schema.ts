import Dexie, { type Table } from 'dexie';
import type { 
  Expense, 
  Person, 
  ImageRecord, 
  RecurringExpense, 
  CategoryBudget,
  Payment,
  Template,
  SplitPreset,
  Tombstone
} from '@/types';

// Database class extending Dexie
export class ExpenseDB extends Dexie {
  expenses!: Table<Expense>;
  people!: Table<Person>;
  images!: Table<ImageRecord>;
  recurring!: Table<RecurringExpense>;
  categoryBudgets!: Table<CategoryBudget>;
  payments!: Table<Payment>;
  templates!: Table<Template>;
  splitPresets!: Table<SplitPreset>;
  tombstones!: Table<Tombstone>;

  constructor(accountId: string) {
    super(`ExpenseTracker_${accountId}`);
    
    // Version 7 - matches current vanilla JS schema
    this.version(7).stores({
      expenses: 'id, date, payerId, syncId, yearMonth',
      people: 'id, name, syncId',
      images: 'id, createdAt',
      recurring: 'id, nextDue, active',
      categoryBudgets: 'category',
      payments: 'id, date, syncId',
      templates: 'id, useCount',
      splitPresets: 'id',
      tombstones: 'syncId, type, deletedAt'
    });
  }
}

// Database instance holder
let db: ExpenseDB | null = null;

// Initialize database for an account
export async function initDB(accountId: string): Promise<ExpenseDB> {
  if (db) {
    db.close();
  }
  db = new ExpenseDB(accountId);
  await db.open();
  return db;
}

// Get current database instance
export function getDB(): ExpenseDB {
  if (!db) {
    throw new Error('Database not initialized. Call initDB first.');
  }
  return db;
}

// Check if database is initialized
export function isDBInitialized(): boolean {
  return db !== null && db.isOpen();
}

// Close database
export function closeDB(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Delete database for an account
export async function deleteDB(accountId: string): Promise<void> {
  closeDB();
  await Dexie.delete(`ExpenseTracker_${accountId}`);
}

// Clear all data in current database
export async function clearAllData(): Promise<void> {
  const database = getDB();
  await database.transaction('rw', [
    database.expenses,
    database.people,
    database.images,
    database.recurring,
    database.categoryBudgets,
    database.payments,
    database.templates,
    database.splitPresets,
    database.tombstones
  ], async () => {
      await database.expenses.clear();
      await database.people.clear();
      await database.images.clear();
      await database.recurring.clear();
      await database.categoryBudgets.clear();
      await database.payments.clear();
      await database.templates.clear();
      await database.splitPresets.clear();
      await database.tombstones.clear();
    }
  );
}

export default db;
