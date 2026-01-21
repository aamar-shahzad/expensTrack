/**
 * UI Management for ExpenseTracker
 */

const UI = {
  currentView: 'home',

  init() {
    this.setupNavigation();
    this.setupModals();
  },

  setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        App.navigateTo(view);
      });
    });
  },

  setupModals() {
    // Modal backdrop click to close
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) {
        this.closeModal();
      }
    });
  },

  loadView(view) {
    this.currentView = view;
    const mainContent = document.getElementById('main-content');

    switch (view) {
      case 'home':
        this.renderHomeView();
        break;
      case 'add':
        this.renderAddView();
        break;
      case 'people':
        this.renderPeopleView();
        break;
      case 'settle':
        this.renderSettleView();
        break;
      case 'sync':
        this.renderSyncView();
        break;
    }
  },

  renderHomeView() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
      <div class="home-view">
        <h1 class="text-center mb-4">Expenses</h1>

        <!-- Month Navigation -->
        <div class="month-nav card mb-4">
          <div class="flex items-center justify-between">
            <button class="btn btn-secondary" id="prev-month">← Prev</button>
            <h2 id="current-month">December 2025</h2>
            <button class="btn btn-secondary" id="next-month">Next →</button>
          </div>
        </div>

        <!-- Summary Cards -->
        <div class="summary-cards mb-4">
          <div class="card">
            <h3>Total Expenses</h3>
            <p class="total-amount">$0.00</p>
          </div>
        </div>

        <!-- Expenses List -->
        <div id="expenses-list" class="expenses-list">
          <div class="card text-center">
            <p>No expenses yet. Add your first expense!</p>
          </div>
        </div>
      </div>
    `;

    // Setup month navigation
    this.setupMonthNavigation();
    // Load expenses for current month
    Expenses.loadCurrentMonth();
  },

  renderAddView() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
      <div class="add-view">
        <h1 class="text-center mb-4">Add Expense</h1>

        <div class="card">
          <form id="expense-form">
            <div class="form-group">
              <label class="form-label">Description</label>
              <input type="text" class="form-input" id="expense-description" required>
            </div>

            <div class="form-group">
              <label class="form-label">Amount</label>
              <input type="number" class="form-input" id="expense-amount" step="0.01" required>
            </div>

            <div class="form-group">
              <label class="form-label">Date</label>
              <input type="date" class="form-input" id="expense-date" required>
            </div>

            <div class="form-group">
              <label class="form-label">Paid by</label>
              <select class="form-select" id="expense-payer" required>
                <option value="">Select person...</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Receipt Photo (optional)</label>
              <div class="camera-controls">
                <button type="button" class="btn btn-secondary" id="capture-photo">
                  📸 Take Photo
                </button>
                <button type="button" class="btn btn-secondary" id="choose-photo">
                  📁 Choose from Gallery
                </button>
              </div>
              <div id="image-preview" class="image-preview hidden"></div>
            </div>

            <div class="flex gap-2 mt-4">
              <button type="submit" class="btn btn-primary flex-1">Save Expense</button>
              <button type="button" class="btn btn-secondary" onclick="App.navigateTo('home')">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Setup form handling
    this.setupExpenseForm();
    // Load people for dropdown
    People.loadForDropdown();
  },

  renderPeopleView() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
      <div class="people-view">
        <div class="flex justify-between items-center mb-4">
          <h1>People</h1>
          <button class="btn btn-primary" id="add-person-btn">+ Add Person</button>
        </div>

        <div id="people-list" class="people-list">
          <div class="card text-center">
            <p>Loading people...</p>
          </div>
        </div>
      </div>
    `;

    // Setup add person button
    document.getElementById('add-person-btn').addEventListener('click', () => {
      this.showAddPersonModal();
    });

    // Load people list
    People.loadPeopleList();
  },

  renderSettleView() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
      <div class="settle-view">
        <h1 class="text-center mb-4">Settlement Calculator</h1>

        <div class="card">
          <div id="settlement-results">
            <p class="text-center">Calculating settlements...</p>
          </div>
        </div>
      </div>
    `;

    // Load settlement calculation
    Settlement.calculate();
  },

  renderSyncView() {
    const mainContent = document.getElementById('main-content');
    const deviceId = Sync.getDeviceId();
    const connectionCount = Sync.getConnectionCount();

    mainContent.innerHTML = `
      <div class="sync-view">
        <h1 class="text-center mb-4">P2P Sync</h1>

        <!-- Device Info -->
        <div class="card mb-4">
          <h3 class="mb-3">Your Device</h3>
          <div class="device-info">
            <p><strong>Device ID:</strong> <code>${deviceId ? deviceId.slice(0, 8) + '...' : 'Not connected'}</code></p>
            <p><strong>Connected Devices:</strong> <span id="connection-count">${connectionCount}</span></p>
            <button class="btn btn-secondary btn-sm" onclick="UI.copyDeviceId()">Copy Full ID</button>
          </div>
        </div>

        <!-- Connect to Device -->
        <div class="card mb-4">
          <h3 class="mb-3">Connect to Another Device</h3>
          <div class="form-group">
            <label class="form-label">Enter Device ID to connect:</label>
            <input type="text" class="form-input" id="remote-device-id" placeholder="Paste device ID here...">
          </div>
          <button class="btn btn-primary" id="connect-device">Connect</button>
        </div>

        <!-- Instructions -->
        <div class="card">
          <h3 class="mb-3">How to Sync</h3>
          <ol class="instructions">
            <li>Share your Device ID with family/friends</li>
            <li>Enter their Device ID above and click Connect</li>
            <li>Expenses, photos, and people will sync automatically</li>
            <li>No internet required - direct device-to-device connection</li>
          </ol>
        </div>
      </div>
    `;

    // Setup connect button
    document.getElementById('connect-device').addEventListener('click', () => {
      const remoteId = document.getElementById('remote-device-id').value.trim();
      if (remoteId) {
        Sync.connectToDevice(remoteId);
      } else {
        App.showError('Please enter a device ID');
      }
    });

    // Add some CSS for the sync view
    const style = document.createElement('style');
    style.textContent = `
      .device-info { margin-bottom: 1rem; }
      .device-info code { background: #f1f5f9; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace; }
      .instructions { padding-left: 1.5rem; }
      .instructions li { margin-bottom: 0.5rem; }
      .btn-sm { padding: 0.5rem 1rem; font-size: 0.875rem; }
    `;
    document.head.appendChild(style);
  },

  copyDeviceId() {
    const deviceId = Sync.getDeviceId();
    if (deviceId) {
      navigator.clipboard.writeText(deviceId).then(() => {
        App.showSuccess('Device ID copied to clipboard');
      }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = deviceId;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        App.showSuccess('Device ID copied to clipboard');
      });
    }
  },

  setupMonthNavigation() {
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');

    prevBtn.addEventListener('click', () => Expenses.navigateMonth(-1));
    nextBtn.addEventListener('click', () => Expenses.navigateMonth(1));
  },

  setupExpenseForm() {
    const form = document.getElementById('expense-form');
    const captureBtn = document.getElementById('capture-photo');
    const chooseBtn = document.getElementById('choose-photo');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      Expenses.saveExpense();
    });

    captureBtn.addEventListener('click', () => Camera.capturePhoto());
    chooseBtn.addEventListener('click', () => Camera.chooseFromGallery());
  },

  showAddPersonModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-container';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">Add Person</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="person-form">
            <div class="form-group">
              <label class="form-label">Name</label>
              <input type="text" class="form-input" id="person-name" required>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-close">Cancel</button>
          <button class="btn btn-primary" id="save-person">Save</button>
        </div>
      </div>
    `;

    document.getElementById('modals').appendChild(modal);

    // Setup modal events
    modal.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => modal.remove());
    });

    document.getElementById('save-person').addEventListener('click', () => {
      People.savePerson();
      modal.remove();
    });
  },

  closeModal() {
    const modals = document.querySelectorAll('.modal-container');
    modals.forEach(modal => modal.remove());
  },

  updateOnlineStatus(isOnline) {
    // Could add visual indicator for online/offline status
    console.log('Network status:', isOnline ? 'online' : 'offline');
  }
};
