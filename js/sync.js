/**
 * P2P Sync Module
 * - Manual sync trigger
 * - Auto timeout after 5 min idle
 * - Keeps device info for reconnection
 */

const Sync = {
  peer: null,
  deviceId: null,
  peerId: null,
  connections: new Map(),
  knownDevices: [], // Remember devices for reconnection
  isInitialized: false,
  idleTimeout: null,
  IDLE_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes

  async init() {
    // Get or create device ID
    this.deviceId = localStorage.getItem('expenseTracker_deviceId');
    if (!this.deviceId) {
      this.deviceId = crypto.randomUUID();
      localStorage.setItem('expenseTracker_deviceId', this.deviceId);
    }

    // Load known devices from storage
    const saved = localStorage.getItem('expenseTracker_knownDevices');
    if (saved) {
      try {
        this.knownDevices = JSON.parse(saved);
      } catch (e) {}
    }

    await this.connect();
  },

  async connect() {
    if (this.peer && !this.peer.destroyed) {
      return; // Already connected
    }

    // Create peer with random suffix
    const suffix = Math.random().toString(36).substring(2, 6);
    this.peerId = 'et' + this.deviceId.substring(0, 6) + suffix;

    try {
      this.peer = new Peer(this.peerId, { debug: 0 });

      this.peer.on('open', (id) => {
        console.log('Sync ready:', id);
        this.peerId = id;
        this.isInitialized = true;
        this.resetIdleTimeout();
      });

      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.warn('Sync error:', err.type);
        if (err.type === 'unavailable-id') {
          // Try again with different ID
          setTimeout(() => this.connect(), 1000);
        }
      });

      this.peer.on('disconnected', () => {
        this.isInitialized = false;
      });

    } catch (e) {
      console.warn('Sync not available:', e);
    }
  },

  handleConnection(conn) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this.saveKnownDevice(conn.peer);
      this.updateBadge();
      this.resetIdleTimeout();
      App.showSuccess('Device connected');
      
      if (App.currentView === 'sync') {
        UI.renderSync();
      }
    });

    conn.on('data', (data) => {
      this.handleData(data, conn.peer);
      this.resetIdleTimeout();
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.updateBadge();
      
      if (App.currentView === 'sync') {
        UI.renderSync();
      }
    });

    conn.on('error', () => {
      this.connections.delete(conn.peer);
    });
  },

  connectToDevice(remoteId) {
    if (!this.peer || !this.isInitialized) {
      App.showError('Connecting... try again');
      this.connect();
      return;
    }

    const id = remoteId.trim();
    if (!id) {
      App.showError('Enter device ID');
      return;
    }

    try {
      const conn = this.peer.connect(id);
      this.handleConnection(conn);
      App.showSuccess('Connecting...');
      this.resetIdleTimeout();
    } catch (e) {
      App.showError('Connection failed');
    }
  },

  // Manual sync - sends data and requests data back
  async syncNow() {
    if (this.connections.size === 0) {
      App.showError('No devices connected');
      return;
    }

    App.showSuccess('Syncing...');
    this.resetIdleTimeout();

    try {
      const data = await DB.getAllData();
      
      const message = {
        type: 'sync_request',
        data: data,
        timestamp: Date.now(),
        from: this.deviceId
      };

      for (const conn of this.connections.values()) {
        conn.send(message);
      }

    } catch (e) {
      console.error('Sync failed:', e);
      App.showError('Sync failed');
    }
  },

  async handleData(message, fromPeer) {
    console.log('Received:', message.type);

    try {
      if (message.type === 'sync_request') {
        // Apply received data
        await this.mergeData(message.data);
        
        // Send our data back
        const myData = await DB.getAllData();
        const conn = this.connections.get(fromPeer);
        if (conn) {
          conn.send({
            type: 'sync_response',
            data: myData,
            timestamp: Date.now(),
            from: this.deviceId
          });
        }

        App.showSuccess('Sync received');
        this.refreshCurrentView();

      } else if (message.type === 'sync_response') {
        // Apply received data
        await this.mergeData(message.data);
        App.showSuccess('Sync complete');
        this.refreshCurrentView();
      }

    } catch (e) {
      console.error('Failed to process sync:', e);
    }
  },

  async mergeData(remoteData) {
    const localData = await DB.getAllData();
    
    // Merge expenses by syncId
    const localExpenseIds = new Set(localData.expenses.map(e => e.syncId));
    for (const expense of remoteData.expenses || []) {
      if (expense.syncId && !localExpenseIds.has(expense.syncId)) {
        await DB.addExpenseRaw(expense);
      }
    }

    // Merge people by syncId
    const localPeopleIds = new Set(localData.people.map(p => p.syncId));
    for (const person of remoteData.people || []) {
      if (person.syncId && !localPeopleIds.has(person.syncId)) {
        await DB.addPersonRaw(person);
      }
    }

    // Merge images by id
    const localImageIds = new Set(localData.images.map(i => i.id));
    for (const image of remoteData.images || []) {
      if (image.id && !localImageIds.has(image.id)) {
        await DB.addImageRaw(image);
      }
    }
  },

  refreshCurrentView() {
    // Refresh the current view to show new data
    if (App.currentView === 'home') {
      Expenses.loadCurrentMonth();
    } else if (App.currentView === 'people') {
      People.loadPeopleList();
    } else if (App.currentView === 'settle') {
      Settlement.calculate();
    } else if (App.currentView === 'sync') {
      UI.renderSync();
    }
  },

  // Idle timeout management
  resetIdleTimeout() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }

    this.idleTimeout = setTimeout(() => {
      this.disconnectIdle();
    }, this.IDLE_TIMEOUT_MS);
  },

  disconnectIdle() {
    console.log('Idle timeout - disconnecting sync');
    
    // Close connections but keep known devices
    for (const conn of this.connections.values()) {
      try { conn.close(); } catch (e) {}
    }
    this.connections.clear();

    // Destroy peer
    if (this.peer && !this.peer.destroyed) {
      try { this.peer.destroy(); } catch (e) {}
    }
    this.peer = null;
    this.isInitialized = false;

    this.updateBadge();
  },

  // Save known device for later reconnection
  saveKnownDevice(peerId) {
    // Extract device part (first 8 chars after 'et')
    const devicePart = peerId.substring(0, 10);
    
    if (!this.knownDevices.includes(devicePart)) {
      this.knownDevices.push(devicePart);
      // Keep only last 10 devices
      if (this.knownDevices.length > 10) {
        this.knownDevices.shift();
      }
      localStorage.setItem('expenseTracker_knownDevices', JSON.stringify(this.knownDevices));
    }
  },

  // Refresh connection when user opens sync tab
  async refresh() {
    // Reconnect if disconnected
    if (!this.peer || this.peer.destroyed || !this.isInitialized) {
      await this.connect();
    }
    this.resetIdleTimeout();
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
