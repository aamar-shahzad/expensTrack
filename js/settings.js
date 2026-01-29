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
  },

  // Auto-backup settings
  isAutoBackupEnabled() {
    return localStorage.getItem('et_autoBackup') === 'true';
  },

  setAutoBackup(enabled) {
    localStorage.setItem('et_autoBackup', enabled.toString());
    if (enabled) {
      this.scheduleAutoBackup();
    }
  },

  getLastBackupDate() {
    return localStorage.getItem('et_lastBackup');
  },

  setLastBackupDate() {
    localStorage.setItem('et_lastBackup', new Date().toISOString());
  },

  scheduleAutoBackup() {
    // Check if backup is due (every 7 days)
    const lastBackup = this.getLastBackupDate();
    if (lastBackup) {
      const daysSinceBackup = (Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceBackup < 7) return;
    }
    
    // Perform backup
    this.createAutoBackup();
  },

  async createAutoBackup() {
    try {
      const data = await DB.getAllData();
      const payments = await DB.getPayments();
      const templates = await DB.getTemplates();
      
      const backupData = {
        version: 2,
        exportedAt: new Date().toISOString(),
        account: Accounts.getCurrentAccount(),
        allAccounts: Accounts.getAll(),
        expenses: data.expenses || [],
        people: data.people || [],
        payments: payments || [],
        templates: templates || [],
        settings: {
          currency: this.currency,
          mode: this.mode,
          budget: this.monthlyBudget,
          darkMode: this.isDarkMode()
        }
      };
      
      // Store backup in localStorage (limited but works offline)
      const backupJson = JSON.stringify(backupData);
      
      // Check size (localStorage limit is ~5MB)
      if (backupJson.length < 4 * 1024 * 1024) {
        localStorage.setItem('et_backup', backupJson);
        this.setLastBackupDate();
        console.log('Auto-backup created:', new Date().toISOString());
      }
    } catch (e) {
      console.error('Auto-backup failed:', e);
    }
  },

  // Create downloadable full backup
  async createFullBackup() {
    try {
      const data = await DB.getAllData();
      const payments = await DB.getPayments();
      const templates = await DB.getTemplates();
      const tombstones = await DB.getTombstones();
      
      const backupData = {
        version: 2,
        exportedAt: new Date().toISOString(),
        deviceId: localStorage.getItem('et_deviceId'),
        account: Accounts.getCurrentAccount(),
        allAccounts: Accounts.getAll(),
        expenses: data.expenses || [],
        people: data.people || [],
        images: (data.images || []).map(img => ({
          id: img.id,
          syncId: img.syncId,
          createdAt: img.createdAt
          // Note: actual image blobs not included due to size
        })),
        payments: payments || [],
        templates: templates || [],
        tombstones: tombstones || [],
        settings: {
          currency: this.currency,
          mode: this.mode,
          budget: this.monthlyBudget,
          darkMode: this.isDarkMode()
        }
      };
      
      const json = JSON.stringify(backupData, null, 2);
      const filename = `expense-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
      this.downloadFile(json, filename, 'application/json');
      
      this.setLastBackupDate();
      App.showSuccess('Full backup created');
      
      return true;
    } catch (e) {
      console.error('Backup failed:', e);
      App.showError('Backup failed');
      return false;
    }
  },

  // Restore from backup file
  async restoreFromBackup(file) {
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      
      if (!backup.version || !backup.expenses) {
        App.showError('Invalid backup file');
        return false;
      }
      
      const count = {
        expenses: backup.expenses?.length || 0,
        people: backup.people?.length || 0,
        payments: backup.payments?.length || 0
      };
      
      if (!confirm(`Restore backup from ${backup.exportedAt}?\n\nThis will add:\n- ${count.expenses} expenses\n- ${count.people} people\n- ${count.payments} payments\n\nExisting data will be merged.`)) {
        return false;
      }
      
      // Restore expenses
      for (const expense of (backup.expenses || [])) {
        await DB.addExpenseRaw(expense);
      }
      
      // Restore people
      for (const person of (backup.people || [])) {
        await DB.addPersonRaw(person);
      }
      
      // Restore payments
      if (backup.payments) {
        for (const payment of backup.payments) {
          try {
            const store = await DB.transaction('payments', 'readwrite');
            await new Promise((resolve, reject) => {
              const request = store.put(payment);
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
            });
          } catch (e) {
            // Ignore duplicates
          }
        }
      }
      
      // Restore settings
      if (backup.settings) {
        if (backup.settings.currency) this.setCurrency(backup.settings.currency);
        if (backup.settings.budget) this.setBudget(backup.settings.budget);
        if (backup.settings.darkMode !== undefined) this.setDarkMode(backup.settings.darkMode);
      }
      
      App.showSuccess('Backup restored!');
      App.navigateTo('home');
      return true;
      
    } catch (e) {
      console.error('Restore failed:', e);
      App.showError('Failed to restore backup');
      return false;
    }
  },

  // Export to CSV
  async exportToCSV() {
    try {
      const expenses = await DB.getAllExpenses();
      const people = await DB.getPeople();
      const peopleMap = {};
      people.forEach(p => peopleMap[p.id] = p.name);
      
      const headers = ['Date', 'Description', 'Amount', 'Payer', 'Category', 'Notes', 'Split With'];
      const rows = expenses.map(exp => {
        const payer = peopleMap[exp.payerId] || 'Unknown';
        const splitWith = (exp.splitWith || []).map(id => peopleMap[id] || 'Unknown').join('; ');
        const category = Expenses.getCategoryIcon(exp.description);
        return [
          exp.date,
          `"${(exp.description || '').replace(/"/g, '""')}"`,
          exp.amount,
          payer,
          category,
          `"${(exp.notes || '').replace(/"/g, '""')}"`,
          `"${splitWith}"`
        ].join(',');
      });
      
      const csv = [headers.join(','), ...rows].join('\n');
      const filename = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
      this.downloadFile(csv, filename, 'text/csv');
      
      App.showSuccess(`Exported ${expenses.length} expenses`);
    } catch (e) {
      console.error('CSV export failed:', e);
      App.showError('Export failed');
    }
  },

  // Export to PDF (simple HTML-based)
  async exportToPDF() {
    try {
      const expenses = await DB.getAllExpenses();
      const people = await DB.getPeople();
      const peopleMap = {};
      people.forEach(p => peopleMap[p.id] = p.name);
      
      // Group by month
      const byMonth = {};
      expenses.forEach(exp => {
        const month = exp.date.substring(0, 7);
        if (!byMonth[month]) byMonth[month] = [];
        byMonth[month].push(exp);
      });
      
      const currency = this.getCurrency();
      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Expense Report</title>
          <style>
            body { font-family: -apple-system, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
            h1 { color: #075e54; }
            h2 { color: #333; border-bottom: 2px solid #075e54; padding-bottom: 8px; margin-top: 30px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #f5f5f5; font-weight: 600; }
            .amount { text-align: right; font-weight: 600; }
            .total { background: #e8f5e9; font-weight: 700; }
            .footer { margin-top: 40px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>💰 Expense Report</h1>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
      `;
      
      const months = Object.keys(byMonth).sort().reverse();
      for (const month of months) {
        const monthExpenses = byMonth[month];
        const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
        const monthName = new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        html += `
          <h2>${monthName}</h2>
          <table>
            <tr><th>Date</th><th>Description</th><th>Payer</th><th class="amount">Amount</th></tr>
        `;
        
        monthExpenses.forEach(exp => {
          html += `
            <tr>
              <td>${exp.date}</td>
              <td>${exp.description}</td>
              <td>${peopleMap[exp.payerId] || '-'}</td>
              <td class="amount">${currency}${exp.amount.toFixed(2)}</td>
            </tr>
          `;
        });
        
        html += `
            <tr class="total">
              <td colspan="3">Total</td>
              <td class="amount">${currency}${total.toFixed(2)}</td>
            </tr>
          </table>
        `;
      }
      
      const grandTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
      html += `
          <div class="footer">
            <p><strong>Grand Total: ${currency}${grandTotal.toFixed(2)}</strong></p>
            <p>Total Expenses: ${expenses.length}</p>
          </div>
        </body>
        </html>
      `;
      
      // Open in new window for printing
      const printWindow = window.open('', '_blank');
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
      
      App.showSuccess('PDF ready to print');
    } catch (e) {
      console.error('PDF export failed:', e);
      App.showError('Export failed');
    }
  }
};
