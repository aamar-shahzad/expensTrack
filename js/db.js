/**
 * IndexedDB Wrapper for ExpenseTracker
 * Supports multiple databases (one per account)
 */

const DB = {
  db: null,
  dbName: 'ExpenseTracker',
  currentAccountId: null,
  version: 6, // Bumped for payments store

  // Get database name for an account
  getDbName(accountId) {
    return accountId ? `ExpenseTracker_${accountId}` : 'ExpenseTracker';
  },

  // Initialize IndexedDB
  async init(accountId = null) {
    this.currentAccountId = accountId;
    const dbName = this.getDbName(accountId);
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains('expenses')) {
          const expensesStore = db.createObjectStore('expenses', { keyPath: 'id' });
          expensesStore.createIndex('date', 'date');
          expensesStore.createIndex('payerId', 'payerId');
          expensesStore.createIndex('syncId', 'syncId');
          expensesStore.createIndex('yearMonth', 'yearMonth');
        }
        
        // Add yearMonth index to existing expenses store
        if (event.oldVersion < 4 && db.objectStoreNames.contains('expenses')) {
          const expensesStore = event.target.transaction.objectStore('expenses');
          if (!expensesStore.indexNames.contains('yearMonth')) {
            expensesStore.createIndex('yearMonth', 'yearMonth');
          }
        }

        if (!db.objectStoreNames.contains('people')) {
          const peopleStore = db.createObjectStore('people', { keyPath: 'id' });
          peopleStore.createIndex('name', 'name');
          peopleStore.createIndex('syncId', 'syncId');
        }

        if (!db.objectStoreNames.contains('images')) {
          const imagesStore = db.createObjectStore('images', { keyPath: 'id' });
          imagesStore.createIndex('createdAt', 'createdAt');
        }

        // Tombstones store for tracking deletions (for sync)
        if (!db.objectStoreNames.contains('tombstones')) {
          const tombstoneStore = db.createObjectStore('tombstones', { keyPath: 'syncId' });
          tombstoneStore.createIndex('type', 'type');
          tombstoneStore.createIndex('deletedAt', 'deletedAt');
        }

        // Templates store for quick-add
        if (!db.objectStoreNames.contains('templates')) {
          const templateStore = db.createObjectStore('templates', { keyPath: 'id' });
          templateStore.createIndex('useCount', 'useCount');
        }

        // Split presets store
        if (!db.objectStoreNames.contains('splitPresets')) {
          db.createObjectStore('splitPresets', { keyPath: 'id' });
        }

        // Payments store for tracking settlements
        if (!db.objectStoreNames.contains('payments')) {
          const paymentsStore = db.createObjectStore('payments', { keyPath: 'id' });
          paymentsStore.createIndex('date', 'date');
          paymentsStore.createIndex('syncId', 'syncId');
        }
      };
    });
  },

  // Generic transaction helper
  async transaction(storeName, mode = 'readonly') {
    if (!this.db) throw new Error('Database not initialized');

    return this.db.transaction([storeName], mode).objectStore(storeName);
  },

  // Expenses operations
  async addExpense(expense) {
    const store = await this.transaction('expenses', 'readwrite');
    const id = crypto.randomUUID();
    
    // Extract yearMonth from date for indexing (e.g., "2024-01")
    const yearMonth = expense.date ? expense.date.substring(0, 7) : null;
    
    const expenseData = {
      ...expense,
      id,
      yearMonth,
      createdAt: Date.now(),
      syncId: crypto.randomUUID(),
      syncStatus: 'pending' // pending, synced
    };

    return new Promise((resolve, reject) => {
      const request = store.add(expenseData);
      request.onsuccess = () => resolve(expenseData);
      request.onerror = () => reject(request.error);
    });
  },

  async markExpenseSynced(syncId) {
    const store = await this.transaction('expenses', 'readwrite');
    return new Promise((resolve, reject) => {
      const index = store.index('syncId');
      const request = index.get(syncId);
      request.onsuccess = () => {
        const expense = request.result;
        if (expense) {
          expense.syncStatus = 'synced';
          expense.lastSyncedAt = Date.now();
          store.put(expense);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  },

  async markAllSynced(syncIds) {
    for (const syncId of syncIds) {
      await this.markExpenseSynced(syncId);
    }
  },

  async getExpenses(month = null, year = null) {
    const store = await this.transaction('expenses');

    return new Promise((resolve, reject) => {
      // Use yearMonth index if filtering by month
      if (month !== null && year !== null) {
        const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
        
        // Try to use index, fall back to filter if index doesn't exist
        if (store.indexNames.contains('yearMonth')) {
          const index = store.index('yearMonth');
          const request = index.getAll(yearMonth);
          
          request.onsuccess = () => {
            const expenses = request.result;
            expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
            resolve(expenses);
          };
          request.onerror = () => reject(request.error);
          return;
        }
      }
      
      // Fallback: get all and filter
      const request = store.getAll();

      request.onsuccess = () => {
        let expenses = request.result;

        if (month !== null && year !== null) {
          expenses = expenses.filter(expense => {
            const dateStr = String(expense.date).split('T')[0];
            const [y, m] = dateStr.split('-').map(n => parseInt(n, 10));
            return m === month + 1 && y === year;
          });
        }

        // Sort by date (newest first)
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
        resolve(expenses);
      };

      request.onerror = () => reject(request.error);
    });
  },

  async getAllExpenses() {
    const store = await this.transaction('expenses');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const expenses = request.result;
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
        resolve(expenses);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async deleteExpense(id) {
    // First get the expense to check for associated image and syncId
    const expense = await this.getExpenseById(id);
    
    const store = await this.transaction('expenses', 'readwrite');

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = async () => {
        // Record tombstone for sync
        if (expense && expense.syncId) {
          try {
            await this.addTombstone(expense.syncId, 'expense');
          } catch (e) {
            console.warn('Failed to add tombstone:', e);
          }
        }
        // Delete associated image if exists
        if (expense && expense.imageId) {
          try {
            await this.deleteImage(expense.imageId);
          } catch (e) {
            console.warn('Failed to delete associated image:', e);
          }
        }
        resolve(true);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async getExpenseById(id) {
    const store = await this.transaction('expenses');

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async updateExpense(id, updates) {
    const store = await this.transaction('expenses', 'readwrite');
    
    return new Promise(async (resolve, reject) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const expense = getReq.result;
        if (!expense) {
          reject(new Error('Expense not found'));
          return;
        }
        
        const updated = { ...expense, ...updates, updatedAt: Date.now() };
        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve(updated);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },

  // People operations
  async addPerson(person) {
    const store = await this.transaction('people', 'readwrite');
    const id = crypto.randomUUID();
    const personData = {
      ...person,
      id,
      createdAt: Date.now(),
      syncId: crypto.randomUUID()
    };

    return new Promise((resolve, reject) => {
      const request = store.add(personData);
      request.onsuccess = () => resolve(personData);
      request.onerror = () => reject(request.error);
    });
  },

  async getPeople() {
    const store = await this.transaction('people');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async deletePerson(id) {
    // Get person first to record tombstone
    const people = await this.getPeople();
    const person = people.find(p => p.id === id);
    
    const store = await this.transaction('people', 'readwrite');

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = async () => {
        // Record tombstone for sync
        if (person && person.syncId) {
          try {
            await this.addTombstone(person.syncId, 'person');
          } catch (e) {
            console.warn('Failed to add tombstone:', e);
          }
        }
        resolve(true);
      };
      request.onerror = () => reject(request.error);
    });
  },

  // Images operations
  async saveImage(blob, thumbnail = null) {
    const store = await this.transaction('images', 'readwrite');
    const id = crypto.randomUUID();
    const imageData = {
      id,
      blob,
      thumbnail,
      createdAt: Date.now(),
      syncId: crypto.randomUUID() // For sync deduplication
    };

    return new Promise((resolve, reject) => {
      const request = store.add(imageData);
      request.onsuccess = () => resolve(imageData);
      request.onerror = () => reject(request.error);
    });
  },

  async getImage(id) {
    const store = await this.transaction('images');

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteImage(id) {
    const store = await this.transaction('images', 'readwrite');

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  // Sync operations
  async getAllData() {
    const [expenses, people, images] = await Promise.all([
      this.getExpenses(),
      this.getPeople(),
      this.getAllImages()
    ]);

    return { expenses, people, images };
  },

  async getAllImages() {
    const store = await this.transaction('images');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async applySyncData(data) {
    const { expenses, people, images } = data;

    // Apply changes in transaction
    const transaction = this.db.transaction(['expenses', 'people', 'images'], 'readwrite');

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);

      // Add/update expenses
      const expenseStore = transaction.objectStore('expenses');
      expenses.forEach(expense => {
        expenseStore.put(expense);
      });

      // Add/update people
      const peopleStore = transaction.objectStore('people');
      people.forEach(person => {
        peopleStore.put(person);
      });

      // Add/update images
      const imageStore = transaction.objectStore('images');
      images.forEach(image => {
        imageStore.put(image);
      });
    });
  },

  // Raw add methods for sync (preserves original IDs)
  async addExpenseRaw(expense) {
    const store = await this.transaction('expenses', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(expense);
      request.onsuccess = () => resolve(expense);
      request.onerror = () => reject(request.error);
    });
  },

  async addPersonRaw(person) {
    const store = await this.transaction('people', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(person);
      request.onsuccess = () => resolve(person);
      request.onerror = () => reject(request.error);
    });
  },

  async addImageRaw(image) {
    const store = await this.transaction('images', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(image);
      request.onsuccess = () => resolve(image);
      request.onerror = () => reject(request.error);
    });
  },

  // Clear all data
  async clearAllData() {
    const transaction = this.db.transaction(['expenses', 'people', 'images'], 'readwrite');
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);

      transaction.objectStore('expenses').clear();
      transaction.objectStore('people').clear();
      transaction.objectStore('images').clear();
    });
  },

  // Switch to a different account's database
  async switchDatabase(accountId) {
    // Close current database
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    
    // Open new database
    await this.init(accountId);
  },

  // Delete an account's database
  async deleteDatabase(accountId) {
    const dbName = this.getDbName(accountId);
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  // Tombstone operations for deletion sync
  async addTombstone(syncId, type) {
    const store = await this.transaction('tombstones', 'readwrite');
    const tombstone = {
      syncId,
      type, // 'expense', 'person', or 'image'
      deletedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const request = store.put(tombstone);
      request.onsuccess = () => resolve(tombstone);
      request.onerror = () => reject(request.error);
    });
  },

  async getTombstones() {
    const store = await this.transaction('tombstones');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async clearOldTombstones(maxAge = 30 * 24 * 60 * 60 * 1000) {
    // Clear tombstones older than 30 days
    const store = await this.transaction('tombstones', 'readwrite');
    const cutoff = Date.now() - maxAge;
    
    return new Promise((resolve, reject) => {
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.value.deletedAt < cutoff) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve(true);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  // Template operations for quick-add
  async addTemplate(template) {
    const store = await this.transaction('templates', 'readwrite');
    const id = crypto.randomUUID();
    const templateData = {
      ...template,
      id,
      useCount: 0,
      createdAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const request = store.add(templateData);
      request.onsuccess = () => resolve(templateData);
      request.onerror = () => reject(request.error);
    });
  },

  async getTemplates() {
    const store = await this.transaction('templates');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        // Sort by use count (most used first)
        const templates = request.result;
        templates.sort((a, b) => b.useCount - a.useCount);
        resolve(templates);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async updateTemplateUseCount(id) {
    const store = await this.transaction('templates', 'readwrite');
    return new Promise((resolve, reject) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const template = getReq.result;
        if (template) {
          template.useCount = (template.useCount || 0) + 1;
          template.lastUsed = Date.now();
          const putReq = store.put(template);
          putReq.onsuccess = () => resolve(template);
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve(null);
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },

  async deleteTemplate(id) {
    const store = await this.transaction('templates', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  // Split preset operations
  async addSplitPreset(preset) {
    const store = await this.transaction('splitPresets', 'readwrite');
    const id = crypto.randomUUID();
    const presetData = {
      ...preset,
      id,
      createdAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const request = store.add(presetData);
      request.onsuccess = () => resolve(presetData);
      request.onerror = () => reject(request.error);
    });
  },

  async getSplitPresets() {
    const store = await this.transaction('splitPresets');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteSplitPreset(id) {
    const store = await this.transaction('splitPresets', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  // Payment operations for settlement tracking
  async addPayment(payment) {
    const store = await this.transaction('payments', 'readwrite');
    const id = crypto.randomUUID();
    const paymentData = {
      ...payment,
      id,
      createdAt: Date.now(),
      syncId: crypto.randomUUID()
    };

    return new Promise((resolve, reject) => {
      const request = store.add(paymentData);
      request.onsuccess = () => resolve(paymentData);
      request.onerror = () => reject(request.error);
    });
  },

  async getPayments() {
    const store = await this.transaction('payments');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const payments = request.result;
        payments.sort((a, b) => new Date(b.date) - new Date(a.date));
        resolve(payments);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async deletePayment(id) {
    const store = await this.transaction('payments', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }
};
