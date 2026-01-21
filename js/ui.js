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
      <h1>Expenses</h1>

      <div class="month-nav">
        <button id="prev-month">‹</button>
        <h2 id="current-month">January 2026</h2>
        <button id="next-month">›</button>
      </div>

      <div class="summary-header">
        <h3>Total Spent</h3>
        <div class="summary-amount" id="total-amount">$0.00</div>
      </div>

      <div id="expenses-list">
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <p>No expenses this month</p>
          <button class="btn btn-primary" onclick="App.navigateTo('add')" style="width: auto; padding: 12px 24px;">Add Expense</button>
        </div>
      </div>
    `;

    this.setupMonthNavigation();
    Expenses.loadCurrentMonth();
  },

  renderAddView() {
    const mainContent = document.getElementById('main-content');
    const today = new Date().toISOString().split('T')[0];
    
    mainContent.innerHTML = `
      <h1>Add Expense</h1>

      <form id="expense-form">
        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" class="form-input" id="expense-description" placeholder="What did you buy?" required>
        </div>

        <div class="form-group">
          <label class="form-label">Amount</label>
          <input type="number" class="form-input" id="expense-amount" placeholder="0.00" step="0.01" inputmode="decimal" required>
        </div>

        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" class="form-input" id="expense-date" value="${today}" required>
        </div>

        <div class="form-group">
          <label class="form-label">Paid By</label>
          <select class="form-select" id="expense-payer" required>
            <option value="">Select person...</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Receipt (Optional)</label>
          <div class="camera-buttons">
            <button type="button" class="btn btn-secondary" id="capture-photo">📷 Camera</button>
            <button type="button" class="btn btn-secondary" id="choose-photo">🖼 Gallery</button>
          </div>
          <div id="image-preview" class="image-preview hidden"></div>
        </div>

        <button type="submit" class="btn btn-primary">Save Expense</button>
      </form>
    `;

    this.setupExpenseForm();
    People.loadForDropdown();
  },

  renderPeopleView() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h1>People</h1>
        <button class="btn btn-primary btn-small" id="add-person-btn">+ Add</button>
      </div>

      <div id="people-list" class="card">
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <p>No people added yet</p>
        </div>
      </div>
    `;

    document.getElementById('add-person-btn').addEventListener('click', () => {
      this.showAddPersonModal();
    });

    People.loadPeopleList();
  },

  renderSettleView() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
      <h1>Settlement</h1>

      <div class="card card-padded" id="settlement-results">
        <div class="empty-state">
          <div class="empty-state-icon">💰</div>
          <p>Add expenses to see who owes whom</p>
        </div>
      </div>
    `;

    Settlement.calculate();
  },

  renderSyncView() {
    const mainContent = document.getElementById('main-content');
    const peerId = Sync.peerId || Sync.deviceId || 'Connecting...';
    const isReady = Sync.isInitialized;
    const connectionCount = Sync.getConnectionCount();

    mainContent.innerHTML = `
      <h1>Sync</h1>

      <div class="sync-status">
        <div class="sync-status-dot ${isReady ? '' : 'offline'}"></div>
        <div class="flex-1">
          <div style="font-weight: 600;">${isReady ? 'Connected' : 'Connecting...'}</div>
          <div style="font-size: 13px; color: #8e8e93;">${connectionCount} device${connectionCount !== 1 ? 's' : ''} paired</div>
        </div>
      </div>

      <div class="section-header">Your Peer ID</div>
      <div class="card card-padded">
        <div class="peer-id-box">${peerId}</div>
        <button class="btn btn-secondary" onclick="UI.copyPeerId()">Copy ID</button>
      </div>

      <div class="section-header">Connect to Device</div>
      <div class="card card-padded">
        <div class="form-group" style="margin-bottom: 12px;">
          <input type="text" class="form-input" id="remote-device-id" placeholder="Paste peer ID here">
        </div>
        <button class="btn btn-primary" id="connect-device">Connect</button>
      </div>

      <div class="section-header">How to Sync</div>
      <div class="card card-padded" style="color: #8e8e93; font-size: 15px; line-height: 1.6;">
        <p style="margin-bottom: 8px;">1. Share your Peer ID with others</p>
        <p style="margin-bottom: 8px;">2. Enter their ID above and tap Connect</p>
        <p style="margin-bottom: 8px;">3. Data syncs automatically</p>
        <p>4. Works offline via direct connection</p>
      </div>
    `;

    document.getElementById('connect-device').addEventListener('click', () => {
      const remoteId = document.getElementById('remote-device-id').value.trim();
      if (remoteId) {
        Sync.connectToDevice(remoteId);
      } else {
        App.showError('Enter a peer ID first');
      }
    });
  },

  copyPeerId() {
    const peerId = Sync.peerId || Sync.deviceId;
    if (peerId) {
      navigator.clipboard.writeText(peerId).then(() => {
        App.showSuccess('Copied!');
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = peerId;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        App.showSuccess('Copied!');
      });
    }
  },

  setupMonthNavigation() {
    document.getElementById('prev-month').addEventListener('click', () => Expenses.navigateMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => Expenses.navigateMonth(1));
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
          <button class="modal-close" onclick="UI.closeModal()">Cancel</button>
          <span class="modal-title">Add Person</span>
          <button class="modal-close" id="save-person" style="color: #007aff; font-weight: 600;">Save</button>
        </div>
        <div class="modal-body">
          <div class="form-group" style="margin: 0;">
            <input type="text" class="form-input" id="person-name" placeholder="Name" autofocus>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modals').appendChild(modal);

    document.getElementById('save-person').addEventListener('click', () => {
      People.savePerson();
      modal.remove();
    });

    document.getElementById('person-name').focus();
  },

  closeModal() {
    document.querySelectorAll('.modal-container').forEach(m => m.remove());
  },

  updateOnlineStatus(isOnline) {
    console.log('Network:', isOnline ? 'online' : 'offline');
  },

  // Helper to render expense list items
  renderExpenseItem(expense) {
    return `
      <div class="list-item" data-id="${expense.id}">
        <div class="list-item-icon">💵</div>
        <div class="list-item-content">
          <div class="list-item-title">${expense.description}</div>
          <div class="list-item-subtitle">${expense.payer} • ${new Date(expense.date).toLocaleDateString()}</div>
        </div>
        <div class="list-item-value">$${parseFloat(expense.amount).toFixed(2)}</div>
      </div>
    `;
  },

  // Helper to render person list items
  renderPersonItem(person) {
    const initial = person.name.charAt(0).toUpperCase();
    return `
      <div class="list-item" data-id="${person.id}">
        <div class="avatar">${initial}</div>
        <div class="list-item-content">
          <div class="list-item-title">${person.name}</div>
        </div>
        <button class="delete-btn" onclick="People.deletePerson('${person.id}')">Delete</button>
      </div>
    `;
  }
};
