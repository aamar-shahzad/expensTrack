/**
 * P2P Sync Module - Bug-free version
 * - Manual sync only
 * - 5 min idle timeout
 * - Robust error handling
 */

const Sync = {
  peer: null,
  deviceId: null,
  peerId: null,
  connections: new Map(),
  isInitialized: false,
  isConnecting: false,
  idleTimeout: null,
  IDLE_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes

  async init() {
    // Get or create persistent device ID
    this.deviceId = localStorage.getItem('et_deviceId');
    if (!this.deviceId) {
      this.deviceId = this.generateId();
      localStorage.setItem('et_deviceId', this.deviceId);
    }
    
    // Don't auto-connect, wait for user to open sync tab
  },

  generateId() {
    return 'xxxxxxxx'.replace(/x/g, () => 
      Math.floor(Math.random() * 16).toString(16)
    );
  },

  async connect() {
    // Prevent multiple connection attempts
    if (this.isConnecting) return;
    if (this.peer && !this.peer.destroyed && this.isInitialized) return;

    this.isConnecting = true;

    // Clean up old peer if exists
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }

    // Generate unique peer ID for this session
    const sessionId = this.generateId().substring(0, 4);
    this.peerId = 'et' + this.deviceId + sessionId;

    try {
      // Check if PeerJS is loaded
      if (typeof Peer === 'undefined') {
        console.warn('PeerJS not loaded');
        this.isConnecting = false;
        return;
      }

      this.peer = new Peer(this.peerId, { 
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        console.log('Sync ready:', id);
        this.peerId = id;
        this.isInitialized = true;
        this.isConnecting = false;
        this.startIdleTimer();
        
        // Update UI if on sync page
        if (App.currentView === 'sync') {
          UI.renderSync();
        }
      });

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.warn('Peer error:', err.type);
        this.isConnecting = false;
        
        if (err.type === 'unavailable-id') {
          // ID taken, retry with new ID
          this.peer = null;
          setTimeout(() => this.connect(), 500);
        } else if (err.type === 'peer-unavailable') {
          App.showError('Device not found');
        }
      });

      this.peer.on('disconnected', () => {
        this.isInitialized = false;
        if (App.currentView === 'sync') {
          UI.renderSync();
        }
      });

      // Timeout for connection
      setTimeout(() => {
        if (this.isConnecting) {
          this.isConnecting = false;
        }
      }, 10000);

    } catch (e) {
      console.error('Failed to create peer:', e);
      this.isConnecting = false;
    }
  },

  setupConnection(conn) {
    const peerId = conn.peer;

    conn.on('open', () => {
      this.connections.set(peerId, conn);
      this.updateBadge();
      this.startIdleTimer();
      App.showSuccess('Connected!');
      
      if (App.currentView === 'sync') {
        UI.renderSync();
      }
    });

    conn.on('data', async (message) => {
      this.startIdleTimer();
      await this.handleMessage(message, peerId);
    });

    conn.on('close', () => {
      this.connections.delete(peerId);
      this.updateBadge();
      
      if (App.currentView === 'sync') {
        UI.renderSync();
      }
    });

    conn.on('error', (err) => {
      console.warn('Connection error:', err);
      this.connections.delete(peerId);
      this.updateBadge();
    });
  },

  connectToDevice(remoteId) {
    const id = (remoteId || '').trim();
    
    if (!id) {
      App.showError('Enter a device ID');
      return;
    }

    if (!this.peer || !this.isInitialized) {
      App.showError('Not ready. Please wait...');
      this.connect();
      return;
    }

    if (this.connections.has(id)) {
      App.showError('Already connected');
      return;
    }

    try {
      App.showSuccess('Connecting...');
      const conn = this.peer.connect(id, { reliable: true });
      this.setupConnection(conn);
      this.startIdleTimer();
    } catch (e) {
      console.error('Connect failed:', e);
      App.showError('Connection failed');
    }
  },

  // Manual sync - triggered by user
  async syncNow() {
    const count = this.connections.size;
    
    if (count === 0) {
      App.showError('No devices connected');
      return;
    }

    this.startIdleTimer();

    try {
      // Get all local data
      const localData = await DB.getAllData();
      
      const message = {
        type: 'sync_request',
        data: {
          expenses: localData.expenses || [],
          people: localData.people || [],
          images: localData.images || []
        },
        deviceId: this.deviceId,
        timestamp: Date.now()
      };

      // Send to all connected devices
      let sent = 0;
      for (const [peerId, conn] of this.connections) {
        try {
          conn.send(message);
          sent++;
        } catch (e) {
          console.warn('Failed to send to', peerId);
        }
      }

      if (sent > 0) {
        App.showSuccess(`Syncing with ${sent} device(s)...`);
      } else {
        App.showError('Failed to send');
      }

    } catch (e) {
      console.error('Sync error:', e);
      App.showError('Sync failed');
    }
  },

  async handleMessage(message, fromPeer) {
    if (!message || !message.type) return;

    console.log('Received:', message.type, 'from:', fromPeer);

    try {
      if (message.type === 'sync_request') {
        // Merge incoming data
        await this.mergeData(message.data);
        
        // Send back our data
        const localData = await DB.getAllData();
        const conn = this.connections.get(fromPeer);
        
        if (conn) {
          conn.send({
            type: 'sync_response',
            data: {
              expenses: localData.expenses || [],
              people: localData.people || [],
              images: localData.images || []
            },
            deviceId: this.deviceId,
            timestamp: Date.now()
          });
        }

        App.showSuccess('Data received & sent back');
        this.refreshView();

      } else if (message.type === 'sync_response') {
        // Merge incoming data
        await this.mergeData(message.data);
        App.showSuccess('Sync complete!');
        this.refreshView();
      }

    } catch (e) {
      console.error('Handle message error:', e);
    }
  },

  async mergeData(remoteData) {
    if (!remoteData) return;

    try {
      const localData = await DB.getAllData();

      // Merge expenses (by syncId to avoid duplicates)
      const localExpenseIds = new Set(
        (localData.expenses || []).map(e => e.syncId).filter(Boolean)
      );
      
      for (const expense of (remoteData.expenses || [])) {
        if (expense.syncId && !localExpenseIds.has(expense.syncId)) {
          await DB.addExpenseRaw(expense);
        }
      }

      // Merge people (by syncId)
      const localPeopleIds = new Set(
        (localData.people || []).map(p => p.syncId).filter(Boolean)
      );
      
      for (const person of (remoteData.people || [])) {
        if (person.syncId && !localPeopleIds.has(person.syncId)) {
          await DB.addPersonRaw(person);
        }
      }

      // Merge images (by id)
      const localImageIds = new Set(
        (localData.images || []).map(i => i.id).filter(Boolean)
      );
      
      for (const image of (remoteData.images || [])) {
        if (image.id && !localImageIds.has(image.id)) {
          await DB.addImageRaw(image);
        }
      }

    } catch (e) {
      console.error('Merge error:', e);
    }
  },

  refreshView() {
    switch (App.currentView) {
      case 'home':
        Expenses.loadCurrentMonth();
        break;
      case 'people':
        People.loadPeopleList();
        break;
      case 'settle':
        Settlement.calculate();
        break;
      case 'sync':
        UI.renderSync();
        break;
    }
  },

  // Idle timeout - disconnect after 5 min of no activity
  startIdleTimer() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }

    this.idleTimeout = setTimeout(() => {
      this.disconnect();
    }, this.IDLE_TIMEOUT_MS);
  },

  disconnect() {
    console.log('Disconnecting (idle timeout)');

    // Close all connections
    for (const conn of this.connections.values()) {
      try { conn.close(); } catch (e) {}
    }
    this.connections.clear();

    // Destroy peer
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }

    this.isInitialized = false;
    this.isConnecting = false;
    this.updateBadge();

    if (App.currentView === 'sync') {
      UI.renderSync();
    }
  },

  // Called when user opens sync tab
  async refresh() {
    if (!this.isInitialized && !this.isConnecting) {
      await this.connect();
    }
    this.startIdleTimer();
  },

  updateBadge() {
    const count = this.connections.size;
    const btn = document.querySelector('[data-view="sync"]');
    if (!btn) return;

    let badge = btn.querySelector('.badge');
    
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'badge';
        btn.appendChild(badge);
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
