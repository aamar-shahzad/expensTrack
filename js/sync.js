/**
 * P2P Sync Module using PeerJS
 */

const Sync = {
  peer: null,
  deviceId: null,
  connections: new Map(),
  isInitialized: false,

  async init() {
    try {
      // Get or create device ID
      this.deviceId = localStorage.getItem('expenseTracker_deviceId');
      if (!this.deviceId) {
        this.deviceId = crypto.randomUUID();
        localStorage.setItem('expenseTracker_deviceId', this.deviceId);
      }

      // Initialize PeerJS
      this.peer = new Peer(this.deviceId, {
        host: 'peerjs.com',
        port: 443,
        path: '/myapp',
        secure: true
      });

      this.peer.on('open', (id) => {
        console.log('PeerJS connected with ID:', id);
        this.isInitialized = true;
      });

      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });

      this.peer.on('error', (error) => {
        console.error('PeerJS error:', error);
        App.showError('P2P sync connection failed');
      });

    } catch (error) {
      console.error('Failed to initialize sync:', error);
    }
  },

  handleConnection(conn) {
    console.log('New connection from:', conn.peer);

    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this.updateConnectionCount();
      App.showSuccess(`Connected to device: ${conn.peer.slice(0, 8)}`);
    });

    conn.on('data', (data) => {
      this.handleIncomingData(data, conn.peer);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.updateConnectionCount();
      App.showSuccess('Device disconnected');
    });

    conn.on('error', (error) => {
      console.error('Connection error:', error);
    });
  },

  async connectToDevice(remoteId) {
    if (!this.peer || !this.isInitialized) {
      App.showError('P2P sync not ready yet');
      return;
    }

    try {
      const conn = this.peer.connect(remoteId.trim());
      this.handleConnection(conn);
    } catch (error) {
      console.error('Failed to connect:', error);
      App.showError('Failed to connect to device');
    }
  },

  async handleIncomingData(data, fromPeer) {
    console.log('Received data from:', fromPeer, data);

    try {
      switch (data.type) {
        case 'sync_request':
          await this.sendFullSync(fromPeer);
          break;

        case 'sync_response':
          await this.applySyncData(data.payload);
          break;

        case 'expense_add':
          await DB.addExpense(data.payload);
          Expenses.loadCurrentMonth();
          break;

        case 'expense_delete':
          await DB.deleteExpense(data.payload.id);
          Expenses.loadCurrentMonth();
          break;

        case 'person_add':
          await DB.addPerson(data.payload);
          People.loadPeopleList();
          People.loadForDropdown();
          break;
      }

      App.showSuccess('Data synced successfully');

    } catch (error) {
      console.error('Failed to handle incoming data:', error);
      App.showError('Failed to sync data');
    }
  },

  async sendFullSync(toPeer) {
    try {
      const data = await DB.getAllData();
      const message = {
        type: 'sync_response',
        payload: data,
        timestamp: Date.now(),
        deviceId: this.deviceId
      };

      const conn = this.connections.get(toPeer);
      if (conn) {
        conn.send(message);
      }
    } catch (error) {
      console.error('Failed to send sync data:', error);
    }
  },

  async applySyncData(syncData) {
    try {
      await DB.applySyncData(syncData);
      // Refresh all views
      Expenses.loadCurrentMonth();
      People.loadPeopleList();
      People.loadForDropdown();
      Settlement.calculate();
    } catch (error) {
      console.error('Failed to apply sync data:', error);
    }
  },

  async broadcastChange(type, payload) {
    if (this.connections.size === 0) return;

    const message = {
      type,
      payload,
      timestamp: Date.now(),
      deviceId: this.deviceId
    };

    for (const conn of this.connections.values()) {
      try {
        conn.send(message);
      } catch (error) {
        console.error('Failed to broadcast to peer:', error);
      }
    }
  },

  updateConnectionCount() {
    const count = this.connections.size;
    // Update UI indicator if exists
    const indicator = document.getElementById('connection-count');
    if (indicator) {
      indicator.textContent = count;
      indicator.style.display = count > 0 ? 'inline' : 'none';
    }

    // Update navigation badge
    this.updateNavBadge(count);
  },

  updateNavBadge(count) {
    const syncBtn = document.querySelector('.nav-btn[data-view="sync"]');
    if (!syncBtn) return;

    // Remove existing badge
    const existingBadge = syncBtn.querySelector('.nav-badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    // Add badge if connected
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'nav-badge';
      badge.textContent = count;
      syncBtn.appendChild(badge);
    }
  },

  getDeviceId() {
    return this.deviceId;
  },

  getConnectionCount() {
    return this.connections.size;
  }
};
