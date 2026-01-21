/**
 * UI Module - Simple and Working
 */

const UI = {
  init() {
    this.setupNavigation();
  },

  setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        App.navigateTo(btn.dataset.view);
      });
    });
  },

  loadView(view) {
    const main = document.getElementById('main-content');
    
    switch (view) {
      case 'home': this.renderHome(); break;
      case 'add': this.renderAdd(); break;
      case 'people': this.renderPeople(); break;
      case 'settle': this.renderSettle(); break;
      case 'sync': 
        // Refresh connection when opening sync tab
        Sync.refresh();
        this.renderSync(); 
        break;
    }
  },

  renderHome() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <h1>Expenses</h1>
      
      <div class="month-nav">
        <button id="prev-month">‹</button>
        <span id="current-month">January 2026</span>
        <button id="next-month">›</button>
      </div>
      
      <div class="summary-box">
        <div class="summary-label">Total This Month</div>
        <div class="summary-amount" id="total-amount">$0.00</div>
        <div class="summary-count" id="expense-count">0 expenses</div>
      </div>
      
      <div id="expenses-list"></div>
    `;
    
    document.getElementById('prev-month').onclick = () => Expenses.navigateMonth(-1);
    document.getElementById('next-month').onclick = () => Expenses.navigateMonth(1);
    
    Expenses.loadCurrentMonth();
  },

  renderAdd() {
    const main = document.getElementById('main-content');
    const today = new Date().toISOString().split('T')[0];
    
    main.innerHTML = `
      <h1>Add Expense</h1>
      
      <form id="expense-form">
        <div class="form-group">
          <label>Description</label>
          <input type="text" id="expense-description" placeholder="What was it for?" required>
        </div>
        
        <div class="form-group">
          <label>Amount</label>
          <input type="number" id="expense-amount" placeholder="0.00" step="0.01" inputmode="decimal" required>
        </div>
        
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="expense-date" value="${today}" required>
        </div>
        
        <div class="form-group">
          <label>Paid By</label>
          <select id="expense-payer" required>
            <option value="">Select person...</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Receipt Photo (Optional)</label>
          <div class="btn-row">
            <button type="button" class="btn-secondary" id="capture-photo">Camera</button>
            <button type="button" class="btn-secondary" id="choose-photo">Gallery</button>
          </div>
          <div id="image-preview" class="hidden"></div>
        </div>
        
        <button type="submit" class="btn-primary">Save Expense</button>
      </form>
    `;
    
    document.getElementById('expense-form').onsubmit = (e) => {
      e.preventDefault();
      Expenses.saveExpense();
    };
    
    document.getElementById('capture-photo').onclick = () => Camera.capturePhoto();
    document.getElementById('choose-photo').onclick = () => Camera.chooseFromGallery();
    
    People.loadForDropdown();
  },

  renderPeople() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <h1>People</h1>
      <div id="people-list"></div>
      <button class="fab" id="add-person-btn">+</button>
    `;
    
    document.getElementById('add-person-btn').onclick = () => this.showAddPersonModal();
    People.loadPeopleList();
  },

  renderSettle() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <h1>Settlement</h1>
      <div id="settlement-results"></div>
    `;
    
    Settlement.calculate();
  },

  renderSync() {
    const main = document.getElementById('main-content');
    const isReady = Sync.isInitialized;
    const deviceId = Sync.getDeviceId() || '------';
    const connections = Sync.getConnectionCount();
    const connectedPeers = Sync.getConnectedPeers();
    
    // Build connected devices HTML
    let connectedHtml = '';
    if (connectedPeers.length > 0) {
      connectedHtml = `
        <div class="card">
          <label>Connected Devices</label>
          <div class="peer-list">
            ${connectedPeers.map(peer => `
              <div class="peer-item">
                <div class="peer-icon">📱</div>
                <div class="peer-id-display">${peer.displayId}</div>
                <button class="btn-icon" onclick="Sync.disconnectPeer('${peer.id}')">✕</button>
              </div>
            `).join('')}
          </div>
          <button class="btn-primary" id="sync-btn" style="margin-top:12px">
            Sync Now
          </button>
        </div>
      `;
    }
    
    main.innerHTML = `
      <h1>Sync</h1>
      
      <div class="status-box ${isReady ? 'online' : 'offline'}">
        <div class="status-dot"></div>
        <div class="status-text">${isReady ? 'Ready to connect' : 'Connecting...'}</div>
        <div class="status-info">${connections} device${connections !== 1 ? 's' : ''} connected</div>
      </div>
      
      <div class="card">
        <label>Your Device ID (never changes)</label>
        <div class="device-id">${deviceId}</div>
        <button class="btn-secondary" onclick="UI.copyDeviceId()">Copy ID</button>
      </div>
      
      ${connectedHtml}
      
      <div class="card">
        <label>Connect to Another Device</label>
        <input type="text" id="remote-id" placeholder="Enter their 6-letter ID" maxlength="6" style="text-transform:uppercase">
        <button class="btn-primary" id="connect-btn">Connect</button>
      </div>
      
      ${connections === 0 ? `
      <div class="card">
        <label>How to Sync</label>
        <ol class="help-list">
          <li>Share your 6-letter ID with the other person</li>
          <li>Enter their ID above and tap Connect</li>
          <li>Once connected, tap "Sync Now"</li>
          <li>Both devices will have the same data</li>
        </ol>
      </div>
      ` : ''}
    `;
    
    document.getElementById('connect-btn').onclick = () => {
      const id = document.getElementById('remote-id').value.trim();
      if (id) {
        Sync.connectToDevice(id);
      } else {
        App.showError('Enter a device ID');
      }
    };
    
    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) {
      syncBtn.onclick = () => Sync.syncNow();
    }
  },

  copyDeviceId() {
    const id = Sync.getDeviceId();
    if (id) {
      navigator.clipboard.writeText(id).then(() => {
        App.showSuccess('Copied!');
      }).catch(() => {
        App.showError('ID: ' + id);
      });
    }
  },

  showAddPersonModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <button class="sheet-cancel" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <span class="sheet-title">Add Person</span>
          <button class="sheet-save" id="save-person-btn">Save</button>
        </div>
        <div class="sheet-body">
          <div class="input-group">
            <label>Name</label>
            <input type="text" id="person-name" placeholder="Enter name" autocomplete="off">
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Focus input after animation
    setTimeout(() => {
      document.getElementById('person-name').focus();
    }, 100);
    
    // Save on button click
    document.getElementById('save-person-btn').onclick = () => {
      const name = document.getElementById('person-name').value.trim();
      if (name) {
        People.savePerson(name);
        modal.remove();
      } else {
        App.showError('Enter a name');
      }
    };
    
    // Save on Enter key
    document.getElementById('person-name').onkeypress = (e) => {
      if (e.key === 'Enter') {
        document.getElementById('save-person-btn').click();
      }
    };
    
    // Close on backdrop tap
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    };
  }
};
