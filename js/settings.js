/**
 * Settings Module
 * - Currency selection
 * - Single/Shared mode
 * - Budget limits
 */

const Settings = {
  // Default settings
  defaults: {
    currency: 'C$',
    mode: 'shared', // 'single' or 'shared'
    monthlyBudget: 0 // 0 means no budget set
  },

  // Initialize with defaults (will be overwritten by init())
  currency: 'C$',
  mode: 'shared',
  monthlyBudget: 0,

  currencies: [
    { symbol: 'C$', name: 'CAD - Canadian Dollar' },
    { symbol: '$', name: 'USD - Dollar' },
    { symbol: '€', name: 'EUR - Euro' },
    { symbol: '£', name: 'GBP - Pound' },
    { symbol: '¥', name: 'JPY - Yen' },
    { symbol: '₹', name: 'INR - Rupee' },
    { symbol: 'A$', name: 'AUD - Australian Dollar' },
    { symbol: 'Fr', name: 'CHF - Swiss Franc' },
    { symbol: 'R', name: 'ZAR - Rand' },
    { symbol: '₽', name: 'RUB - Ruble' }
  ],

  init() {
    // Load settings from localStorage
    this.currency = localStorage.getItem('et_currency') || this.defaults.currency;
    this.mode = localStorage.getItem('et_mode') || this.defaults.mode;
    this.monthlyBudget = parseFloat(localStorage.getItem('et_budget')) || this.defaults.monthlyBudget;
    
    // Apply dark mode if saved
    if (this.isDarkMode()) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    
    console.log('Settings initialized:', this.currency, this.mode);
  },

  isDarkMode() {
    return localStorage.getItem('et_darkMode') === 'true';
  },

  setDarkMode(enabled) {
    localStorage.setItem('et_darkMode', enabled.toString());
    if (enabled) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  },

  getCurrency() {
    return this.currency;
  },

  setCurrency(symbol) {
    this.currency = symbol;
    localStorage.setItem('et_currency', symbol);
  },

  getMode() {
    return this.mode;
  },

  setMode(mode) {
    this.mode = mode;
    localStorage.setItem('et_mode', mode);
    // Update navigation visibility
    this.updateNavigation();
  },

  isSharedMode() {
    return this.mode === 'shared';
  },

  isSingleMode() {
    return this.mode === 'single';
  },

  updateNavigation() {
    const peopleBtn = document.querySelector('[data-view="people"]');
    const settleBtn = document.querySelector('[data-view="settle"]');
    const syncBtn = document.querySelector('[data-view="sync"]');

    if (this.isSingleMode()) {
      peopleBtn?.classList.add('hidden');
      settleBtn?.classList.add('hidden');
      syncBtn?.classList.add('hidden');
    } else {
      peopleBtn?.classList.remove('hidden');
      settleBtn?.classList.remove('hidden');
      syncBtn?.classList.remove('hidden');
    }
  },

  // Format amount with currency
  formatAmount(amount) {
    const num = parseFloat(amount) || 0;
    return `${this.currency}${num.toFixed(2)}`;
  },

  // Budget methods
  getBudget() {
    return this.monthlyBudget;
  },

  setBudget(amount) {
    this.monthlyBudget = parseFloat(amount) || 0;
    localStorage.setItem('et_budget', this.monthlyBudget.toString());
  },

  hasBudget() {
    return this.monthlyBudget > 0;
  },

  // Calculate budget status
  getBudgetStatus(spent) {
    if (!this.hasBudget()) return null;
    
    const percent = (spent / this.monthlyBudget) * 100;
    const remaining = this.monthlyBudget - spent;
    
    let status = 'ok';
    if (percent >= 100) status = 'over';
    else if (percent >= 80) status = 'warning';
    
    return {
      budget: this.monthlyBudget,
      spent: spent,
      remaining: remaining,
      percent: Math.min(percent, 100),
      status: status
    };
  },

  // Export data as CSV
  async exportCSV() {
    try {
      const expenses = await DB.getAllExpenses();
      const people = await DB.getPeople();
      const peopleMap = {};
      people.forEach(p => peopleMap[p.id] = p.name);

      // CSV header
      let csv = 'Date,Description,Amount,Paid By,Split Type,Category\n';
      
      // Add rows
      for (const exp of expenses) {
        const date = exp.date;
        const desc = `"${(exp.description || '').replace(/"/g, '""')}"`;
        const amount = parseFloat(exp.amount).toFixed(2);
        const payer = peopleMap[exp.payerId] || 'Self';
        const split = exp.splitType || 'equal';
        const category = Expenses.getCategoryIcon(exp.description);
        
        csv += `${date},${desc},${amount},${payer},${split},${category}\n`;
      }

      this.downloadFile(csv, `expenses_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
      App.showSuccess('Exported to CSV');
    } catch (e) {
      console.error('Export failed:', e);
      App.showError('Export failed');
    }
  },

  // Export data as JSON
  async exportJSON() {
    try {
      const data = await DB.getAllData();
      // Remove blobs from images for JSON export
      const cleanImages = (data.images || []).map(img => ({
        id: img.id,
        syncId: img.syncId,
        createdAt: img.createdAt
      }));

      const exportData = {
        exportedAt: new Date().toISOString(),
        account: Accounts.getCurrentAccount()?.name || 'Default',
        expenses: data.expenses || [],
        people: data.people || [],
        imageCount: cleanImages.length
      };

      const json = JSON.stringify(exportData, null, 2);
      this.downloadFile(json, `expenses_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
      App.showSuccess('Exported to JSON');
    } catch (e) {
      console.error('Export failed:', e);
      App.showError('Export failed');
    }
  },

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
