/**
 * P2P Sync Module
 * - Permanent device ID for sharing
 * - Manual sync only
 * - 5 min idle timeout
 */

const Sync = {
  peer: null,
  deviceId: null,
  connections: new Map(),
  isInitialized: false,
  isConnecting: false,
  retryCount: 0,
  maxRetries: 3,
  idleTimeout: null,
  IDLE_TIMEOUT_MS: 5 * 60 * 1000,

  async init() {
    // Get or create PERMANENT device ID (never changes)
    this.deviceId = localStorage.getItem('et_deviceId');
    if (!this.deviceId) {
      // Create a short, easy to share ID
      this.deviceId = this.generateShortId();
      localStorage.setItem('et_deviceId', this.deviceId);
    }
  },

  generateShortId() {
    // Generate 6 character alphanumeric ID (easy to share)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (0,O,1,I)
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  },

  async connect() {
    if (this.isConnecting) return;
    if (this.peer && !this.peer.destroyed && this.isInitialized) return;

    this.isConnecting = true;

    // Clean up old peer
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }

    // Use permanent device ID as peer ID
    const peerId = 'et-' + this.deviceId;

    try {
      if (typeof Peer === 'undefined') {
        console.warn('PeerJS not loaded');
        this.isConnecting = false;
        return;
      }

      this.peer = new Peer(peerId, { 
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
        this.isInitialized = true;
        this.isConnecting = false;
        this.retryCount = 0;
        this.startIdleTimer();
        
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
          // ID is taken (maybe old session still active on server)
          // Wait a bit and retry - PeerJS server will release it
          this.retryCount++;
          if (this.retryCount <= this.maxRetries) {
            App.showError(`Connecting... (attempt ${this.retryCount})`);
            setTimeout(() => {
              this.peer = null;
              this.connect();
            }, 2000 * this.retryCount);
          } else {
            App.showError('Connection busy. Try again in a minute.');
            this.retryCount = 0;
          }
        } else if (err.type === 'peer-unavailable') {
          App.showError('Device not found or offline');
        }
      });

      this.peer.on('disconnected', () => {
        this.isInitialized = false;
        if (App.currentView === 'sync') {
          UI.renderSync();
        }
      });

      // Connection timeout
      setTimeout(() => {
        if (this.isConnecting) {
          this.isConnecting = false;
        }
      }, 15000);

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
    let id = (remoteId || '').trim().toUpperCase();
    
    if (!id) {
      App.showError('Enter a device ID');
      return;
    }

    // Add prefix if user didn't include it
    if (!id.startsWith('ET-')) {
      id = 'et-' + id;
    } else {
      id = 'et-' + id.substring(3);
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

  async syncNow() {
    const count = this.connections.size;
    
    if (count === 0) {
      App.showError('No devices connected');
      return;
    }

    this.startIdleTimer();

    try {
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

    console.log('Received:', message.type);

    try {
      if (message.type === 'sync_request') {
        await this.mergeData(message.data);
        
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

      const localExpenseIds = new Set(
        (localData.expenses || []).map(e => e.syncId).filter(Boolean)
      );
      
      for (const expense of (remoteData.expenses || [])) {
        if (expense.syncId && !localExpenseIds.has(expense.syncId)) {
          await DB.addExpenseRaw(expense);
        }
      }

      const localPeopleIds = new Set(
        (localData.people || []).map(p => p.syncId).filter(Boolean)
      );
      
      for (const person of (remoteData.people || [])) {
        if (person.syncId && !localPeopleIds.has(person.syncId)) {
          await DB.addPersonRaw(person);
        }
      }

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

    for (const conn of this.connections.values()) {
      try { conn.close(); } catch (e) {}
    }
    this.connections.clear();

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
