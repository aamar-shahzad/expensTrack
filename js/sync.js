/**
 * P2P Sync Module
 * - Permanent device ID for sharing
 * - Manual sync only
 * - Auto-reconnect on disconnect
 * - 10 min idle timeout
 */

const Sync = {
  peer: null,
  deviceId: null,
  connections: new Map(),
  savedConnections: [], // Remember connections for auto-reconnect
  isInitialized: false,
  isConnecting: false,
  retryCount: 0,
  maxRetries: 3,
  idleTimeout: null,
  reconnectTimer: null,
  syncProgress: 0,
  IDLE_TIMEOUT_MS: 10 * 60 * 1000, // 10 minutes

  async init() {
    // Get or create PERMANENT device ID (never changes)
    this.deviceId = localStorage.getItem('et_deviceId');
    if (!this.deviceId) {
      // Create a short, easy to share ID
      this.deviceId = this.generateShortId();
      localStorage.setItem('et_deviceId', this.deviceId);
    }
    
    // Load saved connections for auto-reconnect
    const saved = localStorage.getItem('et_savedConnections');
    this.savedConnections = saved ? JSON.parse(saved) : [];
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
        
        // Auto-reconnect to saved devices
        setTimeout(() => this.autoReconnect(), 1000);
        
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

    // Check if already connected to this peer
    if (this.connections.has(peerId)) {
      console.log('Already connected to', peerId);
      return;
    }

    conn.on('open', () => {
      console.log('Connection opened with', peerId);
      this.connections.set(peerId, conn);
      this.updateBadge();
      this.startIdleTimer();
      App.showSuccess('Device connected!');
      
      // Save this connection for auto-reconnect
      this.saveConnection(peerId);
      
      if (App.currentView === 'sync') {
        UI.renderSync();
      }
    });

    conn.on('data', async (message) => {
      this.startIdleTimer();
      await this.handleMessage(message, peerId);
    });

    conn.on('close', () => {
      console.log('Connection closed with', peerId);
      this.connections.delete(peerId);
      this.updateBadge();
      
      // Try to auto-reconnect after a short delay
      this.scheduleReconnect(peerId);
      
      if (App.currentView === 'sync') {
        UI.renderSync();
      }
    });

    conn.on('error', (err) => {
      console.warn('Connection error with', peerId, err);
      this.connections.delete(peerId);
      this.updateBadge();
    });
  },

  // Save connection for auto-reconnect
  saveConnection(peerId) {
    const shortId = peerId.replace('et-', '');
    if (!this.savedConnections.includes(shortId)) {
      this.savedConnections.push(shortId);
      // Keep only last 5 connections
      if (this.savedConnections.length > 5) {
        this.savedConnections = this.savedConnections.slice(-5);
      }
      localStorage.setItem('et_savedConnections', JSON.stringify(this.savedConnections));
    }
  },

  // Remove saved connection
  removeSavedConnection(peerId) {
    const shortId = peerId.replace('et-', '');
    this.savedConnections = this.savedConnections.filter(id => id !== shortId);
    localStorage.setItem('et_savedConnections', JSON.stringify(this.savedConnections));
  },

  // Schedule auto-reconnect
  scheduleReconnect(peerId) {
    // Only auto-reconnect if the app is active
    if (document.hidden) return;
    
    // Don't reconnect if we're on sync page and user manually disconnected
    const shortId = peerId.replace('et-', '');
    if (!this.savedConnections.includes(shortId)) return;
    
    // Try to reconnect after 3 seconds
    setTimeout(() => {
      if (!this.connections.has(peerId) && this.isInitialized) {
        console.log('Auto-reconnecting to', peerId);
        this.connectToDevice(shortId);
      }
    }, 3000);
  },

  // Try to reconnect to saved connections
  async autoReconnect() {
    if (!this.isInitialized || this.savedConnections.length === 0) return;
    
    for (const shortId of this.savedConnections) {
      const peerId = 'et-' + shortId;
      if (!this.connections.has(peerId)) {
        // Small delay between reconnection attempts
        await new Promise(r => setTimeout(r, 1000));
        try {
          const conn = this.peer.connect(peerId, { reliable: true });
          this.setupConnection(conn);
        } catch (e) {
          console.warn('Auto-reconnect failed for', shortId);
        }
      }
    }
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

    // Disable sync button during sync
    const syncBtn = document.getElementById('sync-btn');
    const progressEl = document.getElementById('sync-progress');
    
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.textContent = 'Preparing...';
    }

    this.startIdleTimer();
    this.updateProgress(0, 'Gathering data...');

    try {
      const localData = await DB.getAllData();
      this.updateProgress(20, 'Processing images...');
      
      // Convert image blobs to base64 for transfer
      const imagesForSync = await this.prepareImagesForSync(localData.images || []);
      this.updateProgress(50, 'Sending data...');
      
      // Include account ID so data only syncs within same account
      const currentAccount = Accounts.getCurrentAccount();
      const message = {
        type: 'sync_request',
        data: {
          expenses: localData.expenses || [],
          people: localData.people || [],
          images: imagesForSync
        },
        accountId: currentAccount?.id,
        accountName: currentAccount?.name,
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
        this.updateProgress(70, `Waiting for response from ${sent} device(s)...`);
        if (syncBtn) {
          syncBtn.textContent = 'Syncing...';
        }
      } else {
        App.showError('Failed to send');
        this.updateProgress(0, '');
        if (syncBtn) {
          syncBtn.disabled = false;
          syncBtn.textContent = 'Sync Now';
        }
      }

    } catch (e) {
      console.error('Sync error:', e);
      App.showError('Sync failed');
      this.updateProgress(0, '');
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Sync Now';
      }
    }
  },

  updateProgress(percent, status) {
    this.syncProgress = percent;
    const progressEl = document.getElementById('sync-progress');
    const statusEl = document.getElementById('sync-status');
    
    if (progressEl) {
      progressEl.style.width = `${percent}%`;
      progressEl.parentElement.classList.toggle('hidden', percent === 0);
    }
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.classList.toggle('hidden', !status);
    }
  },

  // Convert blobs to base64 for P2P transfer
  async prepareImagesForSync(images) {
    const prepared = [];
    for (const img of images) {
      try {
        const imgCopy = { ...img };
        if (img.blob instanceof Blob) {
          imgCopy.blobBase64 = await this.blobToBase64(img.blob);
          delete imgCopy.blob;
        }
        if (img.thumbnail instanceof Blob) {
          imgCopy.thumbnailBase64 = await this.blobToBase64(img.thumbnail);
          delete imgCopy.thumbnail;
        }
        prepared.push(imgCopy);
      } catch (e) {
        console.warn('Failed to prepare image:', img.id);
      }
    }
    return prepared;
  },

  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  base64ToBlob(base64) {
    const parts = base64.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const data = atob(parts[1]);
    const array = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      array[i] = data.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
  },

  async handleMessage(message, fromPeer) {
    if (!message || !message.type) return;

    console.log('Received:', message.type, 'from account:', message.accountName);
    
    const currentAccount = Accounts.getCurrentAccount();

    try {
      if (message.type === 'sync_request') {
        // Check if accounts match (only sync within same account)
        if (message.accountId && message.accountId !== currentAccount?.id) {
          App.showError(`Different account: "${message.accountName || 'Unknown'}". Switch to same account to sync.`);
          this.updateProgress(0, '');
          
          // Send rejection response
          const conn = this.connections.get(fromPeer);
          if (conn) {
            conn.send({
              type: 'sync_rejected',
              reason: 'account_mismatch',
              yourAccount: message.accountName,
              myAccount: currentAccount?.name,
              deviceId: this.deviceId
            });
          }
          return;
        }
        
        this.updateProgress(30, 'Receiving data...');
        await this.mergeData(message.data);
        
        this.updateProgress(60, 'Preparing response...');
        const localData = await DB.getAllData();
        const imagesForSync = await this.prepareImagesForSync(localData.images || []);
        const conn = this.connections.get(fromPeer);
        
        if (conn) {
          this.updateProgress(80, 'Sending response...');
          conn.send({
            type: 'sync_response',
            data: {
              expenses: localData.expenses || [],
              people: localData.people || [],
              images: imagesForSync
            },
            accountId: currentAccount?.id,
            accountName: currentAccount?.name,
            deviceId: this.deviceId,
            timestamp: Date.now()
          });
        }

        this.updateProgress(100, 'Complete!');
        App.showSuccess('Data received & sent back');
        setTimeout(() => this.updateProgress(0, ''), 2000);
        this.refreshView();

      } else if (message.type === 'sync_response') {
        // Check if accounts match
        if (message.accountId && message.accountId !== currentAccount?.id) {
          App.showError(`Account mismatch with "${message.accountName}"`);
          this.resetSyncButton();
          this.updateProgress(0, '');
          return;
        }
        
        this.updateProgress(85, 'Processing received data...');
        await this.mergeData(message.data);
        
        this.updateProgress(100, 'Sync complete!');
        App.showSuccess('Sync complete!');
        
        this.resetSyncButton();
        setTimeout(() => this.updateProgress(0, ''), 2000);
        this.refreshView();
        
      } else if (message.type === 'sync_rejected') {
        if (message.reason === 'account_mismatch') {
          App.showError(`Account mismatch! You: "${message.yourAccount}", They: "${message.myAccount}"`);
        } else {
          App.showError('Sync rejected by other device');
        }
        this.resetSyncButton();
        this.updateProgress(0, '');
      }

    } catch (e) {
      console.error('Handle message error:', e);
      this.updateProgress(0, '');
      this.resetSyncButton();
    }
  },

  resetSyncButton() {
    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.textContent = 'Sync Now';
    }
  },

  async mergeData(remoteData) {
    if (!remoteData) return;

    try {
      const localData = await DB.getAllData();

      // Merge expenses
      const localExpenseIds = new Set(
        (localData.expenses || []).map(e => e.syncId).filter(Boolean)
      );
      
      for (const expense of (remoteData.expenses || [])) {
        if (expense.syncId && !localExpenseIds.has(expense.syncId)) {
          await DB.addExpenseRaw(expense);
        }
      }

      // Merge people
      const localPeopleIds = new Set(
        (localData.people || []).map(p => p.syncId).filter(Boolean)
      );
      
      for (const person of (remoteData.people || [])) {
        if (person.syncId && !localPeopleIds.has(person.syncId)) {
          await DB.addPersonRaw(person);
        }
      }

      // Merge images (convert base64 back to blobs)
      const localImageIds = new Set(
        (localData.images || []).map(i => i.id).filter(Boolean)
      );
      
      for (const image of (remoteData.images || [])) {
        if (image.id && !localImageIds.has(image.id)) {
          // Convert base64 back to blobs
          const imageToSave = { ...image };
          if (image.blobBase64) {
            imageToSave.blob = this.base64ToBlob(image.blobBase64);
            delete imageToSave.blobBase64;
          }
          if (image.thumbnailBase64) {
            imageToSave.thumbnail = this.base64ToBlob(image.thumbnailBase64);
            delete imageToSave.thumbnailBase64;
          }
          await DB.addImageRaw(imageToSave);
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
  },

  // Get list of connected peers for UI
  getConnectedPeers() {
    const peers = [];
    for (const [peerId, conn] of this.connections) {
      // Extract the 6-letter ID from peer ID (format: et-XXXXXX)
      const displayId = peerId.replace('et-', '').substring(0, 6);
      peers.push({
        id: peerId,
        displayId: displayId
      });
    }
    return peers;
  },

  // Disconnect a specific peer
  disconnectPeer(peerId) {
    const conn = this.connections.get(peerId);
    if (conn) {
      try { conn.close(); } catch (e) {}
      this.connections.delete(peerId);
      this.updateBadge();
      App.showSuccess('Disconnected');
      
      if (App.currentView === 'sync') {
        UI.renderSync();
      }
    }
  }
};
