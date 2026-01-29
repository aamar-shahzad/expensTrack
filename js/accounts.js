/**
 * Accounts Module
 * - Multiple accounts support
 * - Each account has separate data
 * - Single accounts are private (no sync)
 * - Shared accounts can sync with others
 */

const Accounts = {
  accounts: [],
  currentAccountId: null,

  init() {
    // Load accounts from localStorage
    const saved = localStorage.getItem('et_accounts');
    try {
      this.accounts = saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse accounts, resetting:', e);
      this.accounts = [];
    }
    
    // Get current account
    this.currentAccountId = localStorage.getItem('et_current_account');
    
    // If no accounts, don't create default - show onboarding instead
    // If accounts exist but no current selected, use first one
    if (this.accounts.length > 0 && (!this.currentAccountId || !this.getAccount(this.currentAccountId))) {
      this.currentAccountId = this.accounts[0].id;
      localStorage.setItem('et_current_account', this.currentAccountId);
    }
    
    console.log('Accounts initialized:', this.accounts.length, 'Current:', this.currentAccountId);
  },

  // Check if this is a new user (no accounts)
  isNewUser() {
    return this.accounts.length === 0;
  },

  // Set current account after creation
  setCurrentAccount(id) {
    this.currentAccountId = id;
    localStorage.setItem('et_current_account', id);
  },

  save() {
    localStorage.setItem('et_accounts', JSON.stringify(this.accounts));
  },

  createAccount(name, mode = 'shared', currency = 'C$') {
    const id = 'acc_' + crypto.randomUUID().slice(0, 8);
    const account = {
      id,
      name,
      mode, // 'single' or 'shared'
      currency,
      createdAt: Date.now()
    };
    
    this.accounts.push(account);
    this.save();
    
    return account;
  },

  getAccount(id) {
    return this.accounts.find(a => a.id === id);
  },

  getCurrentAccount() {
    return this.getAccount(this.currentAccountId);
  },

  async switchAccount(id) {
    const account = this.getAccount(id);
    if (!account) return false;
    
    this.currentAccountId = id;
    localStorage.setItem('et_current_account', id);
    
    // Reinitialize DB with new account's database
    await DB.switchDatabase(id);
    
    // Update settings based on account
    Settings.setCurrency(account.currency);
    Settings.setMode(account.mode);
    
    // Update navigation visibility
    Settings.updateNavigation();
    
    // Reload current view (go to home if current view is hidden)
    const view = (account.mode === 'single' && ['people', 'settle', 'sync'].includes(App.currentView)) 
      ? 'home' 
      : App.currentView;
    App.navigateTo(view);
    
    return true;
  },

  updateAccount(id, updates) {
    const index = this.accounts.findIndex(a => a.id === id);
    if (index === -1) return false;
    
    // Don't allow changing mode after creation
    delete updates.mode;
    
    this.accounts[index] = { ...this.accounts[index], ...updates };
    this.save();
    
    // If updating current account, update settings
    if (id === this.currentAccountId) {
      if (updates.currency) Settings.setCurrency(updates.currency);
    }
    
    return true;
  },

  async deleteAccount(id) {
    // Can't delete last account
    if (this.accounts.length <= 1) {
      App.showError("Can't delete last account");
      return false;
    }
    
    // Can't delete current account
    if (id === this.currentAccountId) {
      App.showError("Switch to another account first");
      return false;
    }
    
    // Remove from list
    this.accounts = this.accounts.filter(a => a.id !== id);
    this.save();
    
    // Delete the database
    await DB.deleteDatabase(id);
    
    return true;
  },

  getAll() {
    return this.accounts;
  },

  // Check if current account is shared mode
  isSharedMode() {
    const account = this.getCurrentAccount();
    return account?.mode === 'shared';
  },

  // Check if current account is single mode
  isSingleMode() {
    const account = this.getCurrentAccount();
    return account?.mode === 'single';
  },

  // Get current account currency
  getCurrency() {
    const account = this.getCurrentAccount();
    return account?.currency || 'C$';
  }
};
