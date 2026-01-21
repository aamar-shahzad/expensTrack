/**
 * P2P Sync Module - Manual sync, background operation
 */

const Sync = {
  peer: null,
  deviceId: null,
  peerId: null,
  connections: new Map(),
  isInitialized: false,

  async init() {
    // Get or create device ID
    this.deviceId = localStorage.getItem('expenseTracker_deviceId');
    if (!this.deviceId) {
      this.deviceId = crypto.randomUUID();
      localStorage.setItem('expenseTracker_deviceId', this.deviceId);
    }

    // Create peer with random suffix to avoid conflicts
    const suffix = Math.random().toString(36).substring(2, 6);
    this.peerId = 'et' + this.deviceId.substring(0, 6) + suffix;

    try {
      this.peer = new Peer(this.peerId, { debug: 0 });

      this.peer.on('open', (id) => {
        console.log('Sync ready:', id);
        this.peerId = id;
        this.isInitialized = true;
      });

      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.warn('Sync error:', err.type);
        this.isInitialized = false;
      });

    } catch (e) {
      console.warn('Sync not available:', e);
    }
  },

  handleConnection(conn) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this.updateBadge();
      App.showSuccess('Device connected');
      
      // Refresh sync view if open
      if (App.currentView === 'sync') {
        UI.renderSync();
      }
    });

    conn.on('data', (data) => {
      this.handleData(data);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.updateBadge();
      
      if (App.currentView === 'sync') {
        UI.renderSync();
      }
    });
  },

  connectToDevice(remoteId) {
    if (!this.peer || !this.isInitialized) {
      App.showError('Sync not ready, try again');
      return;
    }

    try {
      const conn = this.peer.connect(remoteId.trim());
      this.handleConnection(conn);
      App.showSuccess('Connecting...');
    } catch (e) {
      App.showError('Connection failed');
    }
  },

  // Manual sync trigger
  async syncNow() {
    if (this.connections.size === 0) {
      App.showError('No devices connected');
      return;
    }

    App.showSuccess('Syncing...');

    try {
      // Get all local data
      const data = await DB.getAllData();
      
      // Send to all connected devices
      const message = {
        type: 'full_sync',
        data: data,
        timestamp: Date.now(),
        from: this.deviceId
      };

      for (const conn of this.connections.values()) {
        conn.send(message);
      }

      App.showSuccess('Sync sent to ' + this.connections.size + ' device(s)');

    } catch (e) {
      console.error('Sync failed:', e);
      App.showError('Sync failed');
    }
  },

  async handleData(message) {
    console.log('Received:', message.type);

    try {
      switch (message.type) {
        case 'full_sync':
          await this.applySync(message.data);
          App.showSuccess('Data received and merged');
          
          // Refresh current view
          UI.loadView(App.currentView);
          break;

        case 'expense_add':
          await DB.addExpense(message.data);
          if (App.currentView === 'home') Expenses.loadCurrentMonth();
          break;

        case 'expense_delete':
          await DB.deleteExpense(message.data.id);
          if (App.currentView === 'home') Expenses.loadCurrentMonth();
          break;

        case 'person_add':
          await DB.addPerson(message.data);
          if (App.currentView === 'people') People.loadPeopleList();
          break;
      }
    } catch (e) {
      console.error('Failed to process sync data:', e);
    }
  },

  async applySync(remoteData) {
    // Merge remote data with local
    // Using syncId to avoid duplicates
    
    const localData = await DB.getAllData();
    
    // Merge expenses
    const localExpenseIds = new Set(localData.expenses.map(e => e.syncId));
    for (const expense of remoteData.expenses) {
      if (!localExpenseIds.has(expense.syncId)) {
        await DB.addExpenseRaw(expense);
      }
    }

    // Merge people
    const localPeopleIds = new Set(localData.people.map(p => p.syncId));
    for (const person of remoteData.people) {
      if (!localPeopleIds.has(person.syncId)) {
        await DB.addPersonRaw(person);
      }
    }

    // Merge images
    const localImageIds = new Set(localData.images.map(i => i.id));
    for (const image of remoteData.images) {
      if (!localImageIds.has(image.id)) {
        await DB.addImageRaw(image);
      }
    }
  },

  updateBadge() {
    const count = this.connections.size;
    const syncBtn = document.querySelector('[data-view="sync"]');
    if (!syncBtn) return;

    let badge = syncBtn.querySelector('.badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'badge';
        syncBtn.appendChild(badge);
      }
      badge.textContent = count;
    } else if (badge) {
      badge.remove();
    }
  },

  getConnectionCount() {
    return this.connections.size;
  },

  getDeviceId() {
    return this.deviceId;
  }
};
