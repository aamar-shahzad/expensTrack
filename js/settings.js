/**
 * Settings Module
 * - Currency selection
 * - Single/Shared mode
 */

const Settings = {
  // Default settings
  defaults: {
    currency: '$',
    mode: 'shared' // 'single' or 'shared'
  },

  currencies: [
    { symbol: '$', name: 'USD - Dollar' },
    { symbol: '€', name: 'EUR - Euro' },
    { symbol: '£', name: 'GBP - Pound' },
    { symbol: '¥', name: 'JPY - Yen' },
    { symbol: '₹', name: 'INR - Rupee' },
    { symbol: 'A$', name: 'AUD - Australian Dollar' },
    { symbol: 'C$', name: 'CAD - Canadian Dollar' },
    { symbol: 'Fr', name: 'CHF - Swiss Franc' },
    { symbol: 'R', name: 'ZAR - Rand' },
    { symbol: '₽', name: 'RUB - Ruble' }
  ],

  init() {
    // Load settings from localStorage
    this.currency = localStorage.getItem('et_currency') || this.defaults.currency;
    this.mode = localStorage.getItem('et_mode') || this.defaults.mode;
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
  }
};
