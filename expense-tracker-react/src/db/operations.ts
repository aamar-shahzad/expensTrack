import { getDB } from './schema';
import type { 
  Expense, 
  Person, 
  ImageRecord, 
  RecurringExpense, 
  Payment,
  Template,
  Tombstone
} from '@/types';
import { generateId, getYearMonth } from '@/types';

// ============ EXPENSE OPERATIONS ============

export async function addExpense(expense: Omit<Expense, 'id' | 'syncId' | 'syncStatus' | 'yearMonth' | 'createdAt'>): Promise<Expense> {
  const db = getDB();
  const id = generateId();
  const expenseData: Expense = {
    ...expense,
    id,
    yearMonth: getYearMonth(expense.date),
    syncId: generateId(),
    syncStatus: 'pending',
    createdAt: Date.now()
  };
  
  await db.expenses.add(expenseData);
  return expenseData;
}

export async function updateExpense(id: string, updates: Partial<Expense>): Promise<void> {
  const db = getDB();
  await db.expenses.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteExpense(id: string): Promise<void> {
  const db = getDB();
  const expense = await db.expenses.get(id);
  if (expense) {
    // Add tombstone for sync
    await db.tombstones.add({
      syncId: expense.syncId,
      type: 'expense',
      deletedAt: Date.now()
    });
    await db.expenses.delete(id);
  }
}

export async function getExpense(id: string): Promise<Expense | undefined> {
  const db = getDB();
  return db.expenses.get(id);
}

export async function getExpensesByMonth(month: number, year: number): Promise<Expense[]> {
  const db = getDB();
  const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
  return db.expenses.where('yearMonth').equals(yearMonth).reverse().sortBy('date');
}

export async function getAllExpenses(): Promise<Expense[]> {
  const db = getDB();
  return db.expenses.orderBy('date').reverse().toArray();
}

export async function markExpenseSynced(syncId: string): Promise<void> {
  const db = getDB();
  const expense = await db.expenses.where('syncId').equals(syncId).first();
  if (expense) {
    await db.expenses.update(expense.id, { syncStatus: 'synced' });
  }
}

// Put expense as-is (for sync merge - preserves id, syncId from remote)
export async function putExpense(expense: Expense): Promise<void> {
  const db = getDB();
  await db.expenses.put(expense);
}

// Put person as-is (for sync merge)
export async function putPerson(person: Person): Promise<void> {
  const db = getDB();
  await db.people.put(person);
}

// ============ PEOPLE OPERATIONS ============

export async function addPerson(person: Omit<Person, 'id' | 'syncId' | 'createdAt'>): Promise<Person> {
  const db = getDB();
  const id = generateId();
  const personData: Person = {
    ...person,
    id,
    syncId: generateId(),
    createdAt: Date.now()
  };
  
  await db.people.add(personData);
  return personData;
}

export async function updatePerson(id: string, updates: Partial<Person>): Promise<void> {
  const db = getDB();
  await db.people.update(id, { ...updates, updatedAt: Date.now() });
}

// Claim a person as the current device's identity
export async function claimPerson(id: string, deviceId: string): Promise<void> {
  const db = getDB();
  await db.people.update(id, { claimedBy: deviceId, updatedAt: Date.now() });
}

export async function deletePerson(id: string): Promise<void> {
  const db = getDB();
  const person = await db.people.get(id);
  if (person) {
    await db.tombstones.add({
      syncId: person.syncId,
      type: 'person',
      deletedAt: Date.now()
    });
    await db.people.delete(id);
  }
}

// Check if a person is referenced by any expenses or payments
export async function isPersonReferenced(id: string): Promise<{ referenced: boolean; expenseCount: number; paymentCount: number }> {
  const db = getDB();
  
  // Check expenses where person is payer or in splitWith
  const expenses = await db.expenses.toArray();
  const expenseCount = expenses.filter(e => 
    e.payerId === id || 
    (e.splitWith && e.splitWith.includes(id)) ||
    (e.splitDetails && id in e.splitDetails)
  ).length;
  
  // Check payments where person is sender or receiver
  const payments = await db.payments.toArray();
  const paymentCount = payments.filter(p => 
    p.fromId === id || p.toId === id
  ).length;
  
  return {
    referenced: expenseCount > 0 || paymentCount > 0,
    expenseCount,
    paymentCount
  };
}

export async function getPerson(id: string): Promise<Person | undefined> {
  const db = getDB();
  return db.people.get(id);
}

export async function getAllPeople(): Promise<Person[]> {
  const db = getDB();
  return db.people.toArray();
}

// ============ IMAGE OPERATIONS ============

export async function addImage(data: Blob, thumbnail: Blob): Promise<ImageRecord> {
  const db = getDB();
  const id = generateId();
  const imageData: ImageRecord = {
    id,
    data,
    thumbnail,
    syncId: generateId(),
    createdAt: Date.now()
  };
  
  await db.images.add(imageData);
  return imageData;
}

export async function getImage(id: string): Promise<ImageRecord | undefined> {
  const db = getDB();
  return db.images.get(id);
}

/** Put image with given id (e.g. when receiving from peer). Use same blob for thumbnail if not provided. */
export async function putImage(id: string, data: Blob, thumbnail?: Blob): Promise<void> {
  const db = getDB();
  const record: ImageRecord = {
    id,
    data,
    thumbnail: thumbnail ?? data,
    syncId: generateId(),
    createdAt: Date.now()
  };
  await db.images.put(record);
}

export async function deleteImage(id: string): Promise<void> {
  const db = getDB();
  const image = await db.images.get(id);
  if (image) {
    await db.tombstones.add({
      syncId: image.syncId,
      type: 'image',
      deletedAt: Date.now()
    });
    await db.images.delete(id);
  }
}

export async function getAllImages(): Promise<ImageRecord[]> {
  const db = getDB();
  return db.images.orderBy('createdAt').reverse().toArray();
}

// ============ RECURRING OPERATIONS ============

export async function addRecurring(recurring: Omit<RecurringExpense, 'id' | 'active' | 'createdAt'>): Promise<RecurringExpense> {
  const db = getDB();
  const id = generateId();
  const data: RecurringExpense = {
    ...recurring,
    id,
    active: true,
    createdAt: Date.now()
  };
  
  await db.recurring.add(data);
  return data;
}

export async function getActiveRecurring(): Promise<RecurringExpense[]> {
  const db = getDB();
  return db.recurring.where('active').equals(1).toArray();
}

export async function getDueRecurring(): Promise<RecurringExpense[]> {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];
  const all = await db.recurring.where('active').equals(1).toArray();
  return all.filter(r => r.nextDue <= today);
}

export async function updateRecurring(id: string, updates: Partial<RecurringExpense>): Promise<void> {
  const db = getDB();
  await db.recurring.update(id, updates);
}

export async function deleteRecurring(id: string): Promise<void> {
  const db = getDB();
  await db.recurring.delete(id);
}

// ============ CATEGORY BUDGET OPERATIONS ============

export async function setCategoryBudget(category: string, amount: number): Promise<void> {
  const db = getDB();
  await db.categoryBudgets.put({ category, amount, updatedAt: Date.now() });
}

export async function getCategoryBudgets(): Promise<Record<string, number>> {
  const db = getDB();
  const budgets = await db.categoryBudgets.toArray();
  const result: Record<string, number> = {};
  budgets.forEach(b => result[b.category] = b.amount);
  return result;
}

export async function deleteCategoryBudget(category: string): Promise<void> {
  const db = getDB();
  await db.categoryBudgets.delete(category);
}

// ============ PAYMENT OPERATIONS ============

export async function addPayment(payment: Omit<Payment, 'id' | 'syncId' | 'createdAt'>): Promise<Payment> {
  const db = getDB();
  const id = generateId();
  const data: Payment = {
    ...payment,
    id,
    syncId: generateId(),
    createdAt: Date.now()
  };
  
  await db.payments.add(data);
  return data;
}

export async function getPayments(): Promise<Payment[]> {
  const db = getDB();
  return db.payments.orderBy('date').reverse().toArray();
}

export async function deletePayment(id: string): Promise<void> {
  const db = getDB();
  const payment = await db.payments.get(id);
  if (payment) {
    await db.tombstones.add({
      syncId: payment.syncId,
      type: 'payment',
      deletedAt: Date.now()
    });
    await db.payments.delete(id);
  }
}

// Put payment as-is (for sync merge - preserves id, syncId from remote)
export async function putPayment(payment: Payment): Promise<void> {
  const db = getDB();
  await db.payments.put(payment);
}

// ============ TEMPLATE OPERATIONS ============

export async function addTemplate(template: Omit<Template, 'id' | 'useCount' | 'createdAt'>): Promise<Template> {
  const db = getDB();
  const id = generateId();
  const data: Template = {
    ...template,
    id,
    useCount: 0,
    createdAt: Date.now()
  };
  
  await db.templates.add(data);
  return data;
}

export async function getTemplates(): Promise<Template[]> {
  const db = getDB();
  return db.templates.orderBy('useCount').reverse().toArray();
}

export async function incrementTemplateUse(id: string): Promise<void> {
  const db = getDB();
  const template = await db.templates.get(id);
  if (template) {
    await db.templates.update(id, { useCount: template.useCount + 1 });
  }
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = getDB();
  await db.templates.delete(id);
}

// ============ TOMBSTONE OPERATIONS ============

export async function getTombstones(): Promise<Tombstone[]> {
  const db = getDB();
  return db.tombstones.toArray();
}

export async function clearOldTombstones(olderThanDays: number = 30): Promise<void> {
  const db = getDB();
  const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
  await db.tombstones.where('deletedAt').below(cutoff).delete();
}

// ============ EXPORT/IMPORT OPERATIONS ============

export async function exportAllData() {
  const db = getDB();
  const [expenses, people, payments, templates, recurring, categoryBudgets] = await Promise.all([
    db.expenses.toArray(),
    db.people.toArray(),
    db.payments.toArray(),
    db.templates.toArray(),
    db.recurring.toArray(),
    db.categoryBudgets.toArray()
  ]);
  
  return {
    expenses,
    people,
    payments,
    templates,
    recurring,
    categoryBudgets,
    exportedAt: new Date().toISOString()
  };
}
