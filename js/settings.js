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
    console.log('Settings initialized:', this.currency, this.mode);
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
  }
};
