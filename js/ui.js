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
        Sync.refresh();
        this.renderSync(); 
        break;
      case 'settings': this.renderSettings(); break;
    }
  },

  renderHome() {
    const main = document.getElementById('main-content');
    const account = Accounts.getCurrentAccount();
    const hasMultipleAccounts = Accounts.getAll().length > 1;
    
    main.innerHTML = `
      ${hasMultipleAccounts ? `
      <div class="account-header" onclick="App.navigateTo('settings')">
        <span class="account-badge">${account?.mode === 'single' ? '👤' : '👥'} ${account?.name || 'Account'}</span>
        <span class="account-switch">Switch ›</span>
      </div>
      ` : ''}
      <h1>Expenses</h1>
      
      <div class="month-nav">
        <button id="prev-month">‹</button>
        <span id="current-month">January 2026</span>
        <button id="next-month">›</button>
      </div>
      
      <div class="summary-box">
        <div class="summary-label">Total This Month</div>
        <div class="summary-amount" id="total-amount">${Settings.getCurrency()}0.00</div>
        <div class="summary-count" id="expense-count">0 expenses</div>
      </div>
      
      <div class="filter-row">
        <button class="filter-btn active" data-filter="month">This Month</button>
        <button class="filter-btn" data-filter="all">All Time</button>
        <button class="filter-btn" data-filter="custom">Custom</button>
      </div>
      
      <div id="custom-date-range" class="custom-range hidden">
        <input type="date" id="filter-from">
        <span>to</span>
        <input type="date" id="filter-to">
        <button class="btn-small btn-primary" id="apply-filter">Apply</button>
      </div>
      
      <div id="expenses-list"></div>
    `;
    
    document.getElementById('prev-month').onclick = () => Expenses.navigateMonth(-1);
    document.getElementById('next-month').onclick = () => Expenses.navigateMonth(1);
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const filter = btn.dataset.filter;
        const customRange = document.getElementById('custom-date-range');
        const monthNav = document.querySelector('.month-nav');
        
        if (filter === 'custom') {
          customRange.classList.remove('hidden');
          monthNav.classList.add('hidden');
        } else {
          customRange.classList.add('hidden');
          monthNav.classList.remove('hidden');
          
          if (filter === 'all') {
            Expenses.loadAllExpenses();
          } else {
            Expenses.loadCurrentMonth();
          }
        }
      };
    });
    
    // Apply custom filter
    document.getElementById('apply-filter').onclick = () => {
      const from = document.getElementById('filter-from').value;
      const to = document.getElementById('filter-to').value;
      if (from && to) {
        Expenses.loadDateRange(from, to);
      } else {
        App.showError('Select both dates');
      }
    };
    
    Expenses.loadCurrentMonth();
  },

  renderAdd() {
    const main = document.getElementById('main-content');
    const today = new Date().toISOString().split('T')[0];
    const isShared = Accounts.isSharedMode();
    const currency = Settings.getCurrency();
    
    main.innerHTML = `
      <h1>Add Expense</h1>
      
      <form id="expense-form">
        <div class="form-group">
          <label>Description</label>
          <input type="text" id="expense-description" placeholder="What was it for?" required>
        </div>
        
        <div class="form-group">
          <label>Amount (${currency})</label>
          <input type="number" id="expense-amount" placeholder="0.00" step="0.01" inputmode="decimal" required>
        </div>
        
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="expense-date" value="${today}" required>
        </div>
        
        ${isShared ? `
        <div class="form-group">
          <label>Paid By</label>
          <select id="expense-payer" required>
            <option value="">Select person...</option>
          </select>
        </div>
        ` : '<input type="hidden" id="expense-payer" value="self">'}
        
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="expense-recurring">
            <span>Recurring monthly expense</span>
          </label>
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
    
    if (isShared) {
      People.loadForDropdown();
    }
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
          <li>Either person enters the other's ID and taps Connect</li>
          <li>Both devices will show as connected</li>
          <li>Either person can tap "Sync Now" to share data</li>
        </ol>
        <p class="help-text" style="margin-top:12px">
          <strong>Note:</strong> Only one person needs to connect. The connection works both ways automatically.
        </p>
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

  renderSettings() {
    const main = document.getElementById('main-content');
    const currentAccount = Accounts.getCurrentAccount();
    const accounts = Accounts.getAll();
    const currentCurrency = currentAccount?.currency || '$';
    const currentMode = currentAccount?.mode || 'shared';
    
    const currencyOptions = Settings.currencies.map(c => 
      `<option value="${c.symbol}" ${c.symbol === currentCurrency ? 'selected' : ''}>${c.symbol} - ${c.name}</option>`
    ).join('');
    
    main.innerHTML = `
      <h1>Settings</h1>
      
      <div class="card">
        <label>Accounts</label>
        <div class="account-list">
          ${accounts.map(acc => `
            <div class="account-item ${acc.id === currentAccount?.id ? 'active' : ''}" data-id="${acc.id}">
              <div class="account-icon">${acc.mode === 'single' ? '👤' : '👥'}</div>
              <div class="account-info">
                <div class="account-name">${acc.name}</div>
                <div class="account-meta">${acc.mode === 'single' ? 'Private' : 'Shared'} • ${acc.currency}</div>
              </div>
              ${acc.id === currentAccount?.id ? '<span class="account-check">✓</span>' : ''}
            </div>
          `).join('')}
        </div>
        <button class="btn-secondary" id="add-account-btn" style="margin-top:12px">+ Add Account</button>
      </div>
      
      <div class="card">
        <label>Current Account: ${currentAccount?.name || 'None'}</label>
        <div class="mode-toggle">
          <button class="mode-btn ${currentMode === 'single' ? 'active' : ''}" data-mode="single">
            <span class="mode-icon">👤</span>
            <span class="mode-name">Private</span>
            <span class="mode-desc">No sync/share</span>
          </button>
          <button class="mode-btn ${currentMode === 'shared' ? 'active' : ''}" data-mode="shared">
            <span class="mode-icon">👥</span>
            <span class="mode-name">Shared</span>
            <span class="mode-desc">Can sync</span>
          </button>
        </div>
      </div>
      
      <div class="card">
        <label>Currency</label>
        <select id="currency-select" class="form-select">
          ${currencyOptions}
        </select>
      </div>
      
      <div class="card">
        <label>Data</label>
        <button class="btn-secondary" id="export-btn" style="margin-bottom:10px">Export Data (JSON)</button>
        <button class="btn-secondary" id="import-btn">Import Data</button>
        <input type="file" id="import-file" accept=".json" style="display:none">
      </div>
      
      <div class="card danger-zone">
        <label>Danger Zone</label>
        <button class="btn-danger" id="clear-data-btn" style="margin-bottom:10px">Clear Account Data</button>
        ${accounts.length > 1 ? `<button class="btn-danger" id="delete-account-btn">Delete This Account</button>` : ''}
        <p class="help-text">Permanently delete all data in this account.</p>
      </div>
    `;
    
    // Account selection
    document.querySelectorAll('.account-item').forEach(item => {
      item.onclick = async () => {
        const id = item.dataset.id;
        if (id !== Accounts.currentAccountId) {
          await Accounts.switchAccount(id);
          App.showSuccess('Switched account');
        }
      };
    });
    
    // Add account
    document.getElementById('add-account-btn').onclick = () => this.showAddAccountModal();
    
    // Mode toggle
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.onclick = () => {
        const mode = btn.dataset.mode;
        Accounts.updateAccount(Accounts.currentAccountId, { mode });
        Settings.setMode(mode);
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        App.showSuccess(`Switched to ${mode === 'single' ? 'private' : 'shared'} mode`);
      };
    });
    
    // Currency select
    document.getElementById('currency-select').onchange = (e) => {
      const currency = e.target.value;
      Accounts.updateAccount(Accounts.currentAccountId, { currency });
      Settings.setCurrency(currency);
      App.showSuccess('Currency updated');
    };
    
    // Export
    document.getElementById('export-btn').onclick = () => this.exportData();
    
    // Import
    document.getElementById('import-btn').onclick = () => {
      document.getElementById('import-file').click();
    };
    document.getElementById('import-file').onchange = (e) => this.importData(e);
    
    // Clear data
    document.getElementById('clear-data-btn').onclick = () => this.clearAllData();
    
    // Delete account
    document.getElementById('delete-account-btn')?.addEventListener('click', () => this.deleteCurrentAccount());
  },

  showAddAccountModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <button class="sheet-cancel" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <span class="sheet-title">New Account</span>
          <button class="sheet-save" id="save-account-btn">Create</button>
        </div>
        <div class="sheet-body">
          <div class="input-group">
            <label>Account Name</label>
            <input type="text" id="account-name" placeholder="e.g., Family, Work, Trip" autocomplete="off">
          </div>
          <div class="input-group">
            <label>Type</label>
            <div class="mode-toggle" style="margin-top:8px">
              <button class="mode-btn" data-mode="single">
                <span class="mode-icon">👤</span>
                <span class="mode-name">Private</span>
              </button>
              <button class="mode-btn active" data-mode="shared">
                <span class="mode-icon">👥</span>
                <span class="mode-name">Shared</span>
              </button>
            </div>
          </div>
          <div class="input-group">
            <label>Currency</label>
            <select id="account-currency" class="form-select">
              ${Settings.currencies.map(c => `<option value="${c.symbol}">${c.symbol} - ${c.name}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    let selectedMode = 'shared';
    
    // Mode selection in modal
    modal.querySelectorAll('.mode-btn').forEach(btn => {
      btn.onclick = () => {
        modal.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMode = btn.dataset.mode;
      };
    });
    
    setTimeout(() => document.getElementById('account-name').focus(), 100);
    
    document.getElementById('save-account-btn').onclick = async () => {
      const name = document.getElementById('account-name').value.trim();
      const currency = document.getElementById('account-currency').value;
      
      if (!name) {
        App.showError('Enter account name');
        return;
      }
      
      const account = Accounts.createAccount(name, selectedMode, currency);
      await Accounts.switchAccount(account.id);
      modal.remove();
      App.showSuccess('Account created');
    };
    
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  },

  async deleteCurrentAccount() {
    const account = Accounts.getCurrentAccount();
    if (!confirm(`Delete account "${account.name}"? All data will be lost!`)) return;
    if (!confirm('Are you sure? This cannot be undone.')) return;
    
    // Switch to another account first
    const others = Accounts.getAll().filter(a => a.id !== account.id);
    if (others.length > 0) {
      await Accounts.switchAccount(others[0].id);
      await Accounts.deleteAccount(account.id);
      App.showSuccess('Account deleted');
    }
  },

  async exportData() {
    try {
      const data = await DB.getAllData();
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: {
          currency: Settings.getCurrency(),
          mode: Settings.getMode()
        },
        expenses: data.expenses,
        people: data.people
        // Note: images not exported (too large)
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expense-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      App.showSuccess('Data exported');
    } catch (e) {
      App.showError('Export failed');
    }
  },

  async importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.expenses || !data.people) {
        App.showError('Invalid backup file');
        return;
      }
      
      if (!confirm(`Import ${data.expenses.length} expenses and ${data.people.length} people? This will add to existing data.`)) {
        return;
      }
      
      // Import people first
      for (const person of data.people) {
        await DB.addPersonRaw(person);
      }
      
      // Import expenses
      for (const expense of data.expenses) {
        await DB.addExpenseRaw(expense);
      }
      
      // Import settings if present
      if (data.settings) {
        if (data.settings.currency) Settings.setCurrency(data.settings.currency);
        if (data.settings.mode) Settings.setMode(data.settings.mode);
      }
      
      App.showSuccess('Data imported');
      App.navigateTo('home');
    } catch (e) {
      App.showError('Import failed - invalid file');
    }
    
    e.target.value = '';
  },

  clearAllData() {
    if (!confirm('Delete ALL data? This cannot be undone!')) return;
    if (!confirm('Are you sure? All expenses, people, and photos will be permanently deleted.')) return;

    DB.clearAllData().then(() => {
      App.showSuccess('All data cleared');
      App.navigateTo('home');
    }).catch(() => {
      App.showError('Failed to clear data');
    });
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
