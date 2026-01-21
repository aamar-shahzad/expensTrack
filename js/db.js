/**
 * IndexedDB Wrapper for ExpenseTracker
 * Supports multiple databases (one per account)
 */

const DB = {
  db: null,
  dbName: 'ExpenseTracker',
  currentAccountId: null,
  version: 1,

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
    const expenseData = {
      ...expense,
      id,
      createdAt: Date.now(),
      syncId: crypto.randomUUID()
    };

    return new Promise((resolve, reject) => {
      const request = store.add(expenseData);
      request.onsuccess = () => resolve(expenseData);
      request.onerror = () => reject(request.error);
    });
  },

  async getExpenses(month = null, year = null) {
    const store = await this.transaction('expenses');

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        let expenses = request.result;

        if (month !== null && year !== null) {
          expenses = expenses.filter(expense => {
            const date = new Date(expense.date);
            return date.getMonth() === month && date.getFullYear() === year;
          });
        }

        // Sort by date (newest first)
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
        resolve(expenses);
      };

      request.onerror = () => reject(request.error);
    });
  },

  async deleteExpense(id) {
    const store = await this.transaction('expenses', 'readwrite');

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
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
    const store = await this.transaction('people', 'readwrite');

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
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
      createdAt: Date.now()
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
  }
};
