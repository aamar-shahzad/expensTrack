/**
 * UI Module - Simple and Working
 */

const UI = {
  // Escape HTML to prevent XSS
  escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  },

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
    
    // Redirect to home if trying to access hidden views in single mode
    if (Accounts.isSingleMode() && ['people', 'settle', 'sync'].includes(view)) {
      App.navigateTo('home');
      return;
    }
    
    switch (view) {
      case 'home': this.renderHome(); break;
      case 'add': this.renderAdd(); break;
      case 'people': this.renderPeople(); break;
      case 'stats': this.renderStats(); break;
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
    const accountName = this.escapeHtml(account?.name || 'Account');
    
    // Dynamic month label
    const now = new Date();
    const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    main.innerHTML = `
      <div class="expenses-header">
        ${hasMultipleAccounts ? `
        <div class="account-header" onclick="App.navigateTo('settings')">
          <span class="account-badge">${account?.mode === 'single' ? '👤' : '👥'} ${accountName}</span>
          <span class="account-switch">Switch ›</span>
        </div>
        ` : ''}
        <h1>Expenses</h1>
        
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="expense-search" placeholder="Search expenses...">
        </div>
        
        <div class="month-nav">
          <button id="prev-month">‹</button>
          <span id="current-month">${monthLabel}</span>
          <button id="next-month">›</button>
        </div>
        
        <div class="summary-box">
          <div class="summary-label">Total This Month</div>
          <div class="summary-amount" id="total-amount">${Settings.getCurrency()}0.00</div>
          <div class="summary-count" id="expense-count">0 expenses</div>
          <div id="budget-progress" class="budget-progress hidden">
            <div class="budget-bar"><div class="budget-fill"></div></div>
            <div class="budget-text"></div>
          </div>
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
        
        <div id="category-filter" class="category-filter">
          <button class="category-chip active" data-category="all">All</button>
          <button class="category-chip" data-category="🍔">🍔</button>
          <button class="category-chip" data-category="☕">☕</button>
          <button class="category-chip" data-category="🛒">🛒</button>
          <button class="category-chip" data-category="🚗">🚗</button>
          <button class="category-chip" data-category="🏠">🏠</button>
          <button class="category-chip" data-category="🎬">🎬</button>
          <button class="category-chip" data-category="💵">💵</button>
        </div>
      </div>
      
      <div id="pull-indicator" class="pull-indicator hidden">
        <span class="pull-spinner"></span>
        <span>Release to refresh</span>
      </div>
      <div id="expenses-list" class="expenses-list"></div>
    `;
    
    document.getElementById('prev-month').onclick = () => Expenses.navigateMonth(-1);
    document.getElementById('next-month').onclick = () => Expenses.navigateMonth(1);
    
    // Setup pull-to-refresh
    this.setupPullToRefresh();
    
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
      if (!from || !to) {
        App.showError('Select both dates');
        return;
      }
      if (from > to) {
        App.showError('Start date must be before end date');
        return;
      }
      Expenses.loadDateRange(from, to);
    };
    
    // Search
    let searchTimeout;
    document.getElementById('expense-search').oninput = (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        Expenses.searchExpenses(e.target.value.trim());
      }, 300);
    };
    
    // Category filter
    document.querySelectorAll('.category-chip').forEach(chip => {
      chip.onclick = () => {
        document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        Expenses.filterByCategory(chip.dataset.category);
      };
    });
    
    Expenses.loadCurrentMonth();
  },

  setupPullToRefresh() {
    const list = document.getElementById('expenses-list');
    const indicator = document.getElementById('pull-indicator');
    if (!list || !indicator) return;

    let startY = 0;
    let pulling = false;
    const threshold = 80;

    list.addEventListener('touchstart', (e) => {
      if (list.scrollTop === 0) {
        startY = e.touches[0].clientY;
        pulling = true;
      }
    }, { passive: true });

    list.addEventListener('touchmove', (e) => {
      if (!pulling) return;
      
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;
      
      if (diff > 0 && list.scrollTop === 0) {
        const pullDistance = Math.min(diff, threshold * 1.5);
        indicator.classList.remove('hidden');
        indicator.style.height = `${pullDistance}px`;
        indicator.style.opacity = Math.min(diff / threshold, 1);
        
        if (diff > threshold) {
          indicator.querySelector('span:last-child').textContent = 'Release to refresh';
        } else {
          indicator.querySelector('span:last-child').textContent = 'Pull to refresh';
        }
      }
    }, { passive: true });

    list.addEventListener('touchend', async () => {
      if (!pulling) return;
      pulling = false;
      
      const height = parseInt(indicator.style.height) || 0;
      
      if (height > threshold) {
        indicator.querySelector('span:last-child').textContent = 'Refreshing...';
        indicator.classList.add('refreshing');
        
        await Expenses.loadCurrentMonth();
        
        setTimeout(() => {
          indicator.classList.remove('refreshing');
          indicator.classList.add('hidden');
          indicator.style.height = '0';
          indicator.style.opacity = '0';
        }, 500);
      } else {
        indicator.classList.add('hidden');
        indicator.style.height = '0';
        indicator.style.opacity = '0';
      }
    });
  },

  renderAdd() {
    const main = document.getElementById('main-content');
    const today = new Date().toISOString().split('T')[0];
    const isShared = Accounts.isSharedMode();
    const currency = Settings.getCurrency();
    
    main.innerHTML = `
      <div class="page-header">
        <h1>Add Expense</h1>
      </div>
      
      <div id="quick-templates" class="quick-templates hidden">
        <div class="templates-header">
          <span>Quick Add</span>
          <button type="button" class="templates-manage-btn" id="manage-templates">Edit</button>
        </div>
        <div id="templates-list" class="templates-list"></div>
      </div>
      
      <form id="expense-form" class="add-form">
        <div class="form-card">
          <div class="amount-input">
            <span class="currency-symbol">${currency}</span>
            <input type="number" id="expense-amount" placeholder="0.00" step="0.01" inputmode="decimal" required autofocus>
          </div>
          
          <input type="text" id="expense-description" class="desc-input" placeholder="What was it for?" required>
          <div id="suggestions-list" class="suggestions-list hidden"></div>
        </div>
        
        <div class="form-card">
          <div class="form-field-row">
            <div class="form-field-icon">📅</div>
            <div class="form-field-content">
              <label>Date</label>
              <input type="date" id="expense-date" value="${today}" required>
            </div>
          </div>
          ${isShared ? `
          <div class="form-field-row">
            <div class="form-field-icon">👤</div>
            <div class="form-field-content">
              <label>Paid By</label>
              <select id="expense-payer" required>
                <option value="">Select person...</option>
              </select>
            </div>
          </div>
          <div class="form-field-row">
            <div class="form-field-icon">⚖️</div>
            <div class="form-field-content">
              <label>Split</label>
              <select id="expense-split">
                <option value="equal">Split equally</option>
                <option value="full">Paid for someone else (100%)</option>
                <option value="custom">Custom split...</option>
              </select>
            </div>
          </div>
          <div id="custom-split-container" class="hidden" style="padding:12px 0">
            <div id="split-inputs"></div>
          </div>
          ` : '<input type="hidden" id="expense-payer" value="self"><input type="hidden" id="expense-split" value="equal">'}
          <div class="form-field-row">
            <div class="form-field-icon">🔄</div>
            <div class="form-field-content">
              <label>Recurring</label>
              <select id="expense-recurring">
                <option value="">One-time expense</option>
                <option value="monthly">Monthly (repeats each month)</option>
              </select>
            </div>
          </div>
        </div>

        <div class="form-card">
          <div class="form-field-row">
            <div class="form-field-icon">🏷️</div>
            <div class="form-field-content">
              <label>Tags</label>
              <input type="text" id="expense-tags" class="tags-input" placeholder="e.g., food, work, travel">
            </div>
          </div>
          <div class="form-field-row">
            <div class="form-field-icon">📝</div>
            <div class="form-field-content">
              <label>Notes</label>
              <textarea id="expense-notes" class="notes-input" placeholder="Add any extra details..." rows="2"></textarea>
            </div>
          </div>
        </div>
        
        <div class="form-card">
          <div id="image-preview" class="hidden"></div>
          <div class="photo-row">
            <button type="button" class="photo-option" id="capture-photo">
              <div class="photo-option-icon">📷</div>
              <span>Take Photo</span>
            </button>
            <button type="button" class="photo-option" id="choose-photo">
              <div class="photo-option-icon">🖼️</div>
              <span>Gallery</span>
            </button>
          </div>
          <div id="ocr-status" class="hidden" style="text-align:center;padding:8px;color:#667781;font-size:13px"></div>
        </div>
        
        <div class="save-buttons">
          <button type="submit" class="btn-primary btn-save">Save Expense</button>
          <button type="button" class="btn-secondary btn-template" id="save-as-template">Save as Template</button>
        </div>
      </form>
    `;
    
    document.getElementById('expense-form').onsubmit = (e) => {
      e.preventDefault();
      Expenses.saveExpense();
    };
    
    document.getElementById('save-as-template').onclick = () => this.saveAsTemplate();
    document.getElementById('manage-templates').onclick = () => this.showManageTemplates();
    
    // Load templates
    this.loadQuickTemplates();
    
    // Setup description suggestions
    this.setupDescriptionSuggestions();
    
    document.getElementById('capture-photo').onclick = () => Camera.capturePhoto();
    document.getElementById('choose-photo').onclick = () => Camera.chooseFromGallery();
    
    // Handle split type change
    if (isShared) {
      People.loadForDropdown();
      document.getElementById('expense-split').onchange = (e) => {
        const container = document.getElementById('custom-split-container');
        if (e.target.value === 'custom') {
          container.classList.remove('hidden');
          this.renderCustomSplitInputs();
        } else {
          container.classList.add('hidden');
        }
      };
    }
  },

  async renderCustomSplitInputs() {
    try {
      const people = await DB.getPeople();
      const presets = await DB.getSplitPresets();
      const container = document.getElementById('split-inputs');
      if (!container || people.length === 0) return;
      
      const equalShare = Math.round(100 / people.length);
      
      // Build presets HTML if any exist
      const presetsHtml = presets.length > 0 ? `
        <div class="split-presets">
          <div class="split-presets-label">Saved presets:</div>
          <div class="split-presets-list">
            ${presets.map(p => `
              <button type="button" class="split-preset-chip" data-preset='${JSON.stringify(p.splits)}'>
                ${this.escapeHtml(p.name)}
              </button>
            `).join('')}
          </div>
        </div>
      ` : '';
      
      container.innerHTML = `
        ${presetsHtml}
        <div style="font-size:13px;color:#667781;margin-bottom:8px">Enter percentage for each person (must total 100%)</div>
        ${people.map((p, i) => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="flex:1">${this.escapeHtml(p.name)}</span>
            <input type="number" class="split-percent" data-id="${this.escapeHtml(p.id)}" value="${i === 0 ? 100 - (equalShare * (people.length - 1)) : equalShare}" min="0" max="100" style="width:60px;padding:8px;border:1px solid #e9edef;border-radius:8px;text-align:center">
            <span>%</span>
          </div>
        `).join('')}
        <div id="split-total" style="text-align:right;font-size:13px;color:#667781">Total: 100%</div>
        <button type="button" class="btn-small btn-secondary" id="save-split-preset" style="margin-top:8px">Save as Preset</button>
      `;
      
      // Update total on change
      container.querySelectorAll('.split-percent').forEach(input => {
        input.oninput = () => {
          const total = Array.from(container.querySelectorAll('.split-percent'))
            .reduce((sum, inp) => sum + (parseInt(inp.value) || 0), 0);
          const totalEl = document.getElementById('split-total');
          totalEl.textContent = `Total: ${total}%`;
          totalEl.style.color = total === 100 ? '#25d366' : '#ff3b30';
        };
      });
      
      // Apply preset on click
      container.querySelectorAll('.split-preset-chip').forEach(chip => {
        chip.onclick = () => {
          const splits = JSON.parse(chip.dataset.preset);
          container.querySelectorAll('.split-percent').forEach(input => {
            const personId = input.dataset.id;
            if (splits[personId] !== undefined) {
              input.value = splits[personId];
            }
          });
          // Trigger total update
          container.querySelector('.split-percent')?.dispatchEvent(new Event('input'));
        };
      });
      
      // Save preset button
      document.getElementById('save-split-preset').onclick = () => this.showSaveSplitPresetModal();
    } catch (err) {
      console.error('Failed to load split inputs:', err);
      App.showError('Could not load people');
    }
  },

  async showSaveSplitPresetModal() {
    const inputs = document.querySelectorAll('.split-percent');
    const total = Array.from(inputs).reduce((sum, inp) => sum + (parseInt(inp.value) || 0), 0);
    
    if (total !== 100) {
      App.showError('Split must total 100% to save');
      return;
    }
    
    const splits = {};
    inputs.forEach(inp => {
      splits[inp.dataset.id] = parseInt(inp.value) || 0;
    });
    
    const name = prompt('Name this split preset:');
    if (!name || !name.trim()) return;
    
    try {
      await DB.addSplitPreset({ name: name.trim(), splits });
      App.showSuccess('Preset saved!');
      this.renderCustomSplitInputs();
    } catch (e) {
      console.error('Failed to save preset:', e);
      App.showError('Failed to save preset');
    }
  },

  // Quick templates
  async loadQuickTemplates() {
    try {
      const templates = await DB.getTemplates();
      const container = document.getElementById('quick-templates');
      const list = document.getElementById('templates-list');
      
      if (templates.length === 0) {
        container.classList.add('hidden');
        return;
      }
      
      container.classList.remove('hidden');
      list.innerHTML = templates.slice(0, 5).map(t => `
        <button type="button" class="template-chip" data-id="${t.id}">
          <span class="template-desc">${this.escapeHtml(t.description)}</span>
          <span class="template-amount">${Settings.formatAmount(t.amount)}</span>
        </button>
      `).join('');
      
      list.querySelectorAll('.template-chip').forEach(chip => {
        chip.onclick = () => this.applyTemplate(chip.dataset.id);
      });
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
  },

  async applyTemplate(templateId) {
    try {
      const templates = await DB.getTemplates();
      const template = templates.find(t => t.id === templateId);
      if (!template) return;
      
      document.getElementById('expense-amount').value = template.amount;
      document.getElementById('expense-description').value = template.description;
      if (template.tags) {
        document.getElementById('expense-tags').value = template.tags;
      }
      if (template.payerId) {
        const payerSelect = document.getElementById('expense-payer');
        if (payerSelect) payerSelect.value = template.payerId;
      }
      
      await DB.updateTemplateUseCount(templateId);
      App.showSuccess('Template applied');
    } catch (e) {
      console.error('Failed to apply template:', e);
    }
  },

  async saveAsTemplate() {
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const description = document.getElementById('expense-description').value.trim();
    const tags = document.getElementById('expense-tags')?.value.trim() || '';
    const payerId = document.getElementById('expense-payer')?.value || '';
    
    if (!amount || !description) {
      App.showError('Enter amount and description first');
      return;
    }
    
    try {
      await DB.addTemplate({
        amount,
        description,
        tags,
        payerId
      });
      App.showSuccess('Template saved!');
      this.loadQuickTemplates();
    } catch (e) {
      console.error('Failed to save template:', e);
      App.showError('Failed to save template');
    }
  },

  showManageTemplates() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <button class="sheet-cancel" onclick="this.closest('.modal-overlay').remove()">Done</button>
          <span class="sheet-title">Manage Templates</span>
          <span></span>
        </div>
        <div class="sheet-body" id="templates-manage-list" style="padding:0">
          <div style="padding:20px;text-align:center;color:var(--text-secondary)">Loading...</div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    this.loadTemplatesForManage();
    
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  },

  async loadTemplatesForManage() {
    const container = document.getElementById('templates-manage-list');
    try {
      const templates = await DB.getTemplates();
      
      if (templates.length === 0) {
        container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-secondary)">
          No templates yet.<br>Save an expense as a template to get started.
        </div>`;
        return;
      }
      
      container.innerHTML = `<div class="settings-list">
        ${templates.map(t => `
          <div class="settings-item template-manage-item" data-id="${t.id}">
            <div class="settings-item-content">
              <div class="settings-item-title">${this.escapeHtml(t.description)}</div>
              <div class="settings-item-subtitle">${Settings.formatAmount(t.amount)} • Used ${t.useCount || 0} times</div>
            </div>
            <button class="template-delete-btn" data-id="${t.id}">✕</button>
          </div>
        `).join('')}
      </div>`;
      
      container.querySelectorAll('.template-delete-btn').forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          await DB.deleteTemplate(btn.dataset.id);
          this.loadTemplatesForManage();
          this.loadQuickTemplates();
        };
      });
    } catch (e) {
      container.innerHTML = `<div style="padding:20px;text-align:center;color:#ff3b30">Failed to load templates</div>`;
    }
  },

  // Smart suggestions based on history
  setupDescriptionSuggestions() {
    const input = document.getElementById('expense-description');
    const suggestionsList = document.getElementById('suggestions-list');
    if (!input || !suggestionsList) return;
    
    let debounceTimer;
    
    input.oninput = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.showSuggestions(input.value), 200);
    };
    
    input.onfocus = () => {
      if (input.value.length >= 2) {
        this.showSuggestions(input.value);
      }
    };
    
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.suggestions-list') && e.target !== input) {
        suggestionsList.classList.add('hidden');
      }
    });
  },

  async showSuggestions(query) {
    const suggestionsList = document.getElementById('suggestions-list');
    if (!query || query.length < 2) {
      suggestionsList.classList.add('hidden');
      return;
    }
    
    try {
      const expenses = await DB.getAllExpenses();
      const q = query.toLowerCase();
      
      // Find unique descriptions that match
      const matches = new Map();
      expenses.forEach(exp => {
        if (exp.description.toLowerCase().includes(q)) {
          const key = exp.description.toLowerCase();
          if (!matches.has(key)) {
            matches.set(key, { description: exp.description, amount: exp.amount });
          }
        }
      });
      
      const suggestions = Array.from(matches.values()).slice(0, 5);
      
      if (suggestions.length === 0) {
        suggestionsList.classList.add('hidden');
        return;
      }
      
      suggestionsList.innerHTML = suggestions.map(s => `
        <div class="suggestion-item" data-desc="${this.escapeHtml(s.description)}" data-amount="${s.amount}">
          <span class="suggestion-desc">${this.escapeHtml(s.description)}</span>
          <span class="suggestion-amount">${Settings.formatAmount(s.amount)}</span>
        </div>
      `).join('');
      
      suggestionsList.classList.remove('hidden');
      
      suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
        item.onclick = () => {
          document.getElementById('expense-description').value = item.dataset.desc;
          document.getElementById('expense-amount').value = item.dataset.amount;
          suggestionsList.classList.add('hidden');
        };
      });
    } catch (e) {
      console.error('Failed to load suggestions:', e);
    }
  },

  renderPeople() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page-header">
        <h1>People</h1>
      </div>
      <div id="people-list"></div>
      <button class="fab" id="add-person-btn">+</button>
    `;
    
    document.getElementById('add-person-btn').onclick = () => this.showAddPersonModal();
    People.loadPeopleList();
  },

  renderSettle() {
    const main = document.getElementById('main-content');
    const currentAccount = Accounts.getCurrentAccount();
    const isShared = Accounts.isSharedMode();
    const accountName = this.escapeHtml(currentAccount?.name || 'Account');
    
    main.innerHTML = `
      <div class="page-header">
        <h1>Settlement</h1>
        <div class="page-account-badge">${isShared ? '👥' : '👤'} ${accountName}</div>
      </div>
      
      <div class="settle-tabs">
        <button class="settle-tab active" data-tab="current">Current</button>
        <button class="settle-tab" data-tab="history">Balance History</button>
      </div>
      
      <div id="settlement-results"></div>
      <div id="balance-history" class="hidden"></div>
    `;
    
    // Tab switching
    document.querySelectorAll('.settle-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.settle-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        if (tab.dataset.tab === 'current') {
          document.getElementById('settlement-results').classList.remove('hidden');
          document.getElementById('balance-history').classList.add('hidden');
        } else {
          document.getElementById('settlement-results').classList.add('hidden');
          document.getElementById('balance-history').classList.remove('hidden');
          this.loadBalanceHistory();
        }
      };
    });
    
    Settlement.calculate();
  },

  async loadBalanceHistory() {
    const container = document.getElementById('balance-history');
    if (!container) return;
    
    container.innerHTML = '<div style="padding:20px;text-align:center">Loading...</div>';
    
    try {
      const expenses = await DB.getAllExpenses();
      const people = await DB.getPeople();
      const payments = await DB.getPayments();
      
      if (people.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">No people added</div></div>';
        return;
      }
      
      // Group expenses by month
      const monthlyData = {};
      
      expenses.forEach(exp => {
        const monthKey = exp.date.substring(0, 7); // "2024-01"
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { expenses: [], payments: [] };
        }
        monthlyData[monthKey].expenses.push(exp);
      });
      
      payments.forEach(pay => {
        const monthKey = pay.date.substring(0, 7);
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { expenses: [], payments: [] };
        }
        monthlyData[monthKey].payments.push(pay);
      });
      
      // Sort months descending
      const sortedMonths = Object.keys(monthlyData).sort().reverse().slice(0, 12);
      
      if (sortedMonths.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">No history yet</div></div>';
        return;
      }
      
      // Build history HTML
      let html = '';
      
      for (const monthKey of sortedMonths) {
        const data = monthlyData[monthKey];
        const [year, month] = monthKey.split('-');
        const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        // Calculate balances for this month
        const monthTotal = data.expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        const paymentTotal = data.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        
        // Calculate per-person stats
        const personPaid = {};
        data.expenses.forEach(exp => {
          personPaid[exp.payerId] = (personPaid[exp.payerId] || 0) + parseFloat(exp.amount);
        });
        
        html += `
          <div class="history-month">
            <div class="history-month-header">
              <span class="history-month-name">${monthName}</span>
              <span class="history-month-total">${Settings.formatAmount(monthTotal)}</span>
            </div>
            <div class="history-month-details">
              ${people.map(p => {
                const paid = personPaid[p.id] || 0;
                return `<div class="history-person-row">
                  <span>${p.name}</span>
                  <span>Paid ${Settings.formatAmount(paid)}</span>
                </div>`;
              }).join('')}
              ${data.payments.length > 0 ? `
                <div class="history-payments-note">
                  ${data.payments.length} settlement${data.payments.length > 1 ? 's' : ''} (${Settings.formatAmount(paymentTotal)})
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }
      
      container.innerHTML = html;
      
    } catch (e) {
      console.error('Failed to load balance history:', e);
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#ff3b30">Failed to load history</div>';
    }
  },

  async renderStats() {
    const main = document.getElementById('main-content');
    const currency = Settings.getCurrency();
    const isShared = Accounts.isSharedMode();
    const currentAccount = Accounts.getCurrentAccount();
    const accountName = this.escapeHtml(currentAccount?.name || 'Account');
    
    try {
      // Get current month expenses
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const allExpenses = await DB.getAllExpenses();
      const monthExpenses = allExpenses.filter(e => {
        const [year, month] = e.date.split('-').map(Number);
        return month - 1 === currentMonth && year === currentYear;
      });
      
      // Calculate stats
      const totalThisMonth = monthExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
      const totalAllTime = allExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
      const avgPerExpense = allExpenses.length > 0 ? totalAllTime / allExpenses.length : 0;
      
      // Calculate days with expenses this month
      const daysWithExpenses = new Set(monthExpenses.map(e => e.date)).size;
      const dailyAvg = daysWithExpenses > 0 ? totalThisMonth / daysWithExpenses : 0;
      
      // Category breakdown for this month
      const categoryTotals = {};
      monthExpenses.forEach(e => {
        const icon = Expenses.getCategoryIcon(e.description);
        categoryTotals[icon] = (categoryTotals[icon] || 0) + parseFloat(e.amount);
      });
      
      // Sort categories by total
      const sortedCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
      
      // Monthly trend (last 6 months)
      const monthlyTotals = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const m = d.getMonth();
        const y = d.getFullYear();
        const monthName = d.toLocaleDateString('en-US', { month: 'short' });
        
        const total = allExpenses.filter(e => {
          const [ey, em] = e.date.split('-').map(Number);
          return em - 1 === m && ey === y;
        }).reduce((sum, e) => sum + parseFloat(e.amount), 0);
        
        monthlyTotals.push({ month: monthName, total });
      }
      
      // Previous month comparison
      const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
      const prevMonth = prevMonthDate.getMonth();
      const prevYear = prevMonthDate.getFullYear();
      const prevMonthExpenses = allExpenses.filter(e => {
        const [year, month] = e.date.split('-').map(Number);
        return month - 1 === prevMonth && year === prevYear;
      });
      const totalPrevMonth = prevMonthExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
      const monthChange = totalPrevMonth > 0 ? ((totalThisMonth - totalPrevMonth) / totalPrevMonth * 100) : 0;
      
      // Get people for spending breakdown (shared mode only)
      let people = [];
      let personTotals = {};
      if (isShared) {
        people = await DB.getPeople();
        allExpenses.forEach(e => {
          if (e.payerId && e.payerId !== 'self') {
            personTotals[e.payerId] = (personTotals[e.payerId] || 0) + parseFloat(e.amount);
          }
        });
      }
      
      main.innerHTML = `
        <div class="page-header">
          <h1>Insights</h1>
          <div class="page-account-badge">${isShared ? '👥' : '👤'} ${accountName}</div>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card highlight">
            <div class="stat-value">${Settings.formatAmount(totalThisMonth)}</div>
            <div class="stat-label">This Month</div>
            ${totalPrevMonth > 0 ? `
              <div class="stat-change ${monthChange >= 0 ? 'up' : 'down'}">
                ${monthChange >= 0 ? '↑' : '↓'} ${Math.abs(monthChange).toFixed(0)}% vs last month
              </div>
            ` : ''}
          </div>
          <div class="stat-card">
            <div class="stat-value">${Settings.formatAmount(dailyAvg)}</div>
            <div class="stat-label">Daily Average</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${monthExpenses.length}</div>
            <div class="stat-label">This Month</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${Settings.formatAmount(avgPerExpense)}</div>
            <div class="stat-label">Avg Expense</div>
          </div>
        </div>
        
        <div class="chart-container">
          <div class="chart-title">Category Breakdown</div>
          <div class="category-bars">
            ${sortedCategories.length > 0 ? sortedCategories.map(([icon, total]) => {
              const percent = totalThisMonth > 0 ? (total / totalThisMonth * 100) : 0;
              return `
                <div class="category-bar-row">
                  <span class="category-icon">${icon}</span>
                  <div class="category-bar-track">
                    <div class="category-bar-fill" style="width: ${percent}%"></div>
                  </div>
                  <span class="category-amount">${Settings.formatAmount(total)}</span>
                </div>
              `;
            }).join('') : '<div class="empty-msg">No expenses this month</div>'}
          </div>
        </div>
        
        <div class="chart-container">
          <div class="chart-title">6-Month Trend</div>
          <canvas id="trend-chart" class="chart-canvas"></canvas>
        </div>
        
        ${isShared && people.length > 0 ? `
        <div class="chart-container">
          <div class="chart-title">Spending by Person</div>
          <canvas id="person-chart" class="chart-canvas"></canvas>
          <div class="chart-legend" id="person-legend"></div>
        </div>
        ` : ''}
        
        <div class="chart-container">
          <div class="chart-title">Quick Stats</div>
          <div class="quick-stats">
            <div class="quick-stat">
              <span class="quick-stat-label">Total Expenses</span>
              <span class="quick-stat-value">${allExpenses.length}</span>
            </div>
            <div class="quick-stat">
              <span class="quick-stat-label">All-Time Total</span>
              <span class="quick-stat-value">${Settings.formatAmount(totalAllTime)}</span>
            </div>
            <div class="quick-stat">
              <span class="quick-stat-label">Days with Expenses</span>
              <span class="quick-stat-value">${daysWithExpenses}</span>
            </div>
            <div class="quick-stat">
              <span class="quick-stat-label">Biggest Expense</span>
              <span class="quick-stat-value">${monthExpenses.length > 0 ? Settings.formatAmount(Math.max(...monthExpenses.map(e => e.amount))) : '-'}</span>
            </div>
          </div>
        </div>
      `;
      
      // Draw charts
      this.drawTrendChart(monthlyTotals);
      if (isShared && people.length > 0) {
        this.drawPersonChart(people, personTotals);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
      main.innerHTML = `
        <div class="page-header">
          <h1>Insights</h1>
          <div class="page-account-badge">${isShared ? '👥' : '👤'} ${accountName}</div>
        </div>
        <div class="empty-msg">Could not load statistics</div>
      `;
    }
  },

  drawTrendChart(data) {
    const canvas = document.getElementById('trend-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    
    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    const maxValue = Math.max(...data.map(d => d.total), 1);
    const barWidth = chartWidth / data.length - 10;
    
    // Draw bars
    data.forEach((d, i) => {
      const barHeight = (d.total / maxValue) * chartHeight;
      const x = padding.left + i * (chartWidth / data.length) + 5;
      const y = padding.top + chartHeight - barHeight;
      
      // Bar
      ctx.fillStyle = '#075e54';
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 4);
      ctx.fill();
      
      // Month label
      ctx.fillStyle = '#667781';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.month, x + barWidth / 2, height - 10);
      
      // Value label
      if (d.total > 0) {
        ctx.fillStyle = '#111b21';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillText(Settings.formatAmount(d.total), x + barWidth / 2, y - 5);
      }
    });
  },

  drawPersonChart(people, totals) {
    const canvas = document.getElementById('person-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    
    const colors = ['#075e54', '#25d366', '#128c7e', '#054d44', '#0a8d6e', '#06453d'];
    const total = Object.values(totals).reduce((sum, v) => sum + v, 0) || 1;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    
    let startAngle = -Math.PI / 2;
    const legendItems = [];
    
    people.forEach((p, i) => {
      const value = totals[p.id] || 0;
      const percent = value / total;
      const endAngle = startAngle + percent * Math.PI * 2;
      
      // Draw slice
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();
      
      legendItems.push({
        name: p.name,
        color: colors[i % colors.length],
        value: value,
        percent: Math.round(percent * 100)
      });
      
      startAngle = endAngle;
    });
    
    // Draw center circle (donut)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    
    // Legend
    const legendEl = document.getElementById('person-legend');
    if (legendEl) {
      legendEl.innerHTML = legendItems.map(item => `
        <div class="legend-item">
          <div class="legend-dot" style="background:${item.color}"></div>
          <span>${item.name}: ${Settings.formatAmount(item.value)} (${item.percent}%)</span>
        </div>
      `).join('');
    }
  },

  renderSync() {
    const main = document.getElementById('main-content');
    const isReady = Sync.isInitialized;
    const deviceId = Sync.getDeviceId() || '------';
    const connections = Sync.getConnectionCount();
    const connectedPeers = Sync.getConnectedPeers();
    const currentAccount = Accounts.getCurrentAccount();
    
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
                <button class="btn-icon" onclick="Sync.disconnectPeer('${peer.id}'); Sync.removeSavedConnection('${peer.id}')">✕</button>
              </div>
            `).join('')}
          </div>
          <div class="sync-progress-container hidden" style="margin-top:12px">
            <div class="sync-progress-bar"><div id="sync-progress" class="sync-progress-fill"></div></div>
            <div id="sync-status" class="sync-status"></div>
          </div>
          <button class="btn-primary" id="sync-btn" style="margin-top:12px">
            Sync Now
          </button>
        </div>
      `;
    }
    
    // Show saved connections that we can auto-reconnect to
    const savedConnections = Sync.savedConnections || [];
    let savedHtml = '';
    if (savedConnections.length > 0 && connectedPeers.length === 0) {
      savedHtml = `
        <div class="card">
          <label>Recent Devices</label>
          <div class="peer-list">
            ${savedConnections.map(id => `
              <div class="peer-item">
                <div class="peer-icon" style="opacity:0.5">📱</div>
                <div class="peer-id-display" style="opacity:0.5">${id}</div>
                <button class="btn-small btn-primary" onclick="Sync.connectToDevice('${id}')">Connect</button>
              </div>
            `).join('')}
          </div>
          <p class="help-text" style="margin-top:8px;font-size:12px">Previously connected devices - tap to reconnect</p>
        </div>
      `;
    }
    
    main.innerHTML = `
      <div class="page-header">
        <h1>Sync</h1>
        <div class="page-account-badge">${currentAccount?.mode === 'single' ? '👤' : '👥'} ${currentAccount?.name || 'Account'}</div>
      </div>
      
      <div class="status-box ${isReady ? 'online' : 'offline'}">
        <div class="status-dot"></div>
        <div class="status-text">${isReady ? 'Ready to connect' : 'Connecting...'}</div>
        <div class="status-info">${connections} device${connections !== 1 ? 's' : ''} connected</div>
      </div>
      
      <div class="card qr-card">
        <label>Your QR Code</label>
        <p class="help-text" style="margin-bottom:12px">Let others scan this to connect instantly</p>
        <div id="qr-code" class="qr-code-container"></div>
        <div class="device-id" style="margin-top:12px">${deviceId}</div>
        <div class="qr-actions">
          <button class="btn-secondary" onclick="UI.copyDeviceId()">Copy ID</button>
          <button class="btn-secondary" onclick="UI.shareInvite()">Share</button>
        </div>
      </div>
      
      ${connectedHtml}
      
      ${savedHtml}
      
      <div class="card">
        <label>Connect to Another Device</label>
        <div class="connect-options">
          <button class="btn-primary scan-btn" id="scan-qr-btn">
            <span class="scan-icon">📷</span> Scan QR Code
          </button>
          <div class="connect-divider"><span>or enter ID manually</span></div>
          <input type="text" id="remote-id" placeholder="Enter their 6-letter ID" maxlength="6" style="text-transform:uppercase">
          <button class="btn-primary" id="connect-btn">Connect</button>
        </div>
      </div>
      
      ${connections === 0 && savedConnections.length === 0 ? `
      <div class="card">
        <label>How to Sync</label>
        <ol class="help-list">
          <li>Show your QR code or share your ID</li>
          <li>Other person scans QR or enters ID</li>
          <li>Both devices will connect automatically</li>
          <li>Tap "Sync Now" to share expenses</li>
        </ol>
      </div>
      ` : ''}
    `;
    
    // Generate QR code
    this.generateSyncQR(deviceId);
    
    // QR Scanner button
    document.getElementById('scan-qr-btn').onclick = () => this.openQRScanner();
    
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

  // Generate QR code for sync
  generateSyncQR(deviceId) {
    const container = document.getElementById('qr-code');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Check if qrcode library is loaded
    if (typeof qrcode === 'undefined') {
      console.warn('QRCode library not loaded');
      container.innerHTML = `<div class="qr-fallback">${deviceId}</div>`;
      return;
    }
    
    try {
      // Create QR code with device ID
      const qr = qrcode(0, 'M');
      qr.addData(`EXPENSE-SYNC:${deviceId}`);
      qr.make();
      
      // Create image from QR code
      const img = document.createElement('img');
      img.src = qr.createDataURL(6, 4);
      img.alt = 'QR Code';
      img.style.borderRadius = '8px';
      container.appendChild(img);
    } catch (error) {
      console.error('QR generation error:', error);
      container.innerHTML = `<div class="qr-fallback">${deviceId}</div>`;
    }
  },

  // Open QR scanner
  openQRScanner() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay qr-scanner-modal';
    modal.innerHTML = `
      <div class="qr-scanner-container">
        <div class="qr-scanner-header">
          <button class="qr-close-btn" id="close-scanner">✕</button>
          <span>Scan QR Code</span>
        </div>
        <div class="qr-scanner-viewport">
          <video id="qr-video" autoplay playsinline></video>
          <div class="qr-scanner-frame"></div>
        </div>
        <p class="qr-scanner-hint">Point camera at QR code to connect</p>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const video = document.getElementById('qr-video');
    let stream = null;
    let scanning = true;
    
    // Start camera
    navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } 
    }).then(s => {
      stream = s;
      video.srcObject = stream;
      video.play();
      
      // Start scanning
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const scanFrame = () => {
        if (!scanning) return;
        
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          if (typeof jsQR !== 'undefined') {
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            if (code && code.data.startsWith('EXPENSE-SYNC:')) {
              const deviceId = code.data.replace('EXPENSE-SYNC:', '');
              scanning = false;
              
              // Stop camera
              stream.getTracks().forEach(t => t.stop());
              modal.remove();
              
              // Connect to device
              App.showSuccess('Found device: ' + deviceId);
              Sync.connectToDevice(deviceId);
              return;
            }
          }
        }
        
        requestAnimationFrame(scanFrame);
      };
      
      scanFrame();
      
    }).catch(err => {
      console.error('Camera error:', err);
      App.showError('Could not access camera');
      modal.remove();
    });
    
    // Close button
    document.getElementById('close-scanner').onclick = () => {
      scanning = false;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      modal.remove();
    };
    
    // Close on backdrop click
    modal.onclick = (e) => {
      if (e.target === modal) {
        scanning = false;
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
        }
        modal.remove();
      }
    };
  },

  // Share invite link
  shareInvite() {
    const deviceId = Sync.getDeviceId();
    const accountName = Accounts.getCurrentAccount()?.name || 'Expense Tracker';
    const appUrl = window.location.origin + window.location.pathname;
    
    const shareText = `Join "${accountName}" on Expense Tracker!\n\n1. Open: ${appUrl}\n2. Create a Shared account\n3. Go to Sync tab\n4. Enter ID: ${deviceId}\n\nOr scan my QR code in the app!`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Join ' + accountName,
        text: shareText
      }).catch(() => {
        this.copyShareText(shareText);
      });
    } else {
      this.copyShareText(shareText);
    }
  },

  copyShareText(text) {
    navigator.clipboard.writeText(text).then(() => {
      App.showSuccess('Invite copied!');
    }).catch(() => {
      App.showError('Could not copy');
    });
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
    
    const currencyName = Settings.currencies.find(c => c.symbol === currentCurrency)?.name || 'Dollar';
    
    main.innerHTML = `
      <div class="page-header">
        <h1>Settings</h1>
      </div>
      
      <div class="settings-section">
        <div class="settings-section-title">Account</div>
        <div class="settings-list">
          ${accounts.map(acc => `
            <div class="settings-item ${acc.id === currentAccount?.id ? 'active' : ''}" data-id="${acc.id}">
              <div class="settings-item-icon">${acc.mode === 'single' ? '👤' : '👥'}</div>
              <div class="settings-item-content">
                <div class="settings-item-title">${acc.name}</div>
                <div class="settings-item-subtitle">${acc.mode === 'single' ? 'Private' : 'Shared'} • ${acc.currency}</div>
              </div>
              ${acc.id === currentAccount?.id ? '<span class="settings-item-check">✓</span>' : ''}
            </div>
          `).join('')}
          <div class="settings-item" id="add-account-btn">
            <div class="settings-item-icon add">+</div>
            <div class="settings-item-content">
              <div class="settings-item-title">Add New Account</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="settings-section">
        <div class="settings-section-title">Preferences</div>
        <div class="settings-list">
          <div class="settings-item" id="currency-item">
            <div class="settings-item-icon">💰</div>
            <div class="settings-item-content">
              <div class="settings-item-title">Currency</div>
              <div class="settings-item-subtitle">${currentCurrency} - ${currencyName}</div>
            </div>
            <span class="settings-item-arrow">›</span>
          </div>
          <div class="settings-item" id="budget-item">
            <div class="settings-item-icon">📊</div>
            <div class="settings-item-content">
              <div class="settings-item-title">Monthly Budget</div>
              <div class="settings-item-subtitle">${Settings.hasBudget() ? Settings.formatAmount(Settings.getBudget()) : 'Not set'}</div>
            </div>
            <span class="settings-item-arrow">›</span>
          </div>
          <div class="settings-item" id="dark-mode-item">
            <div class="settings-item-icon">🌙</div>
            <div class="settings-item-content">
              <div class="settings-item-title">Dark Mode</div>
              <div class="settings-item-subtitle">${Settings.isDarkMode() ? 'On' : 'Off'}</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="dark-mode-toggle" ${Settings.isDarkMode() ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
      
      <div class="settings-section">
        <div class="settings-section-title">Backup & Export</div>
        <div class="settings-list">
          <div class="settings-item" id="full-backup-btn">
            <div class="settings-item-icon">💾</div>
            <div class="settings-item-content">
              <div class="settings-item-title">Create Full Backup</div>
              <div class="settings-item-subtitle">${Settings.getLastBackupDate() ? 'Last: ' + new Date(Settings.getLastBackupDate()).toLocaleDateString() : 'Never backed up'}</div>
            </div>
          </div>
          <div class="settings-item" id="restore-backup-btn">
            <div class="settings-item-icon">📥</div>
            <div class="settings-item-content">
              <div class="settings-item-title">Restore from Backup</div>
              <div class="settings-item-subtitle">Import a backup file</div>
            </div>
          </div>
          <div class="settings-item" id="export-btn">
            <div class="settings-item-icon">📊</div>
            <div class="settings-item-content">
              <div class="settings-item-title">Export Data</div>
              <div class="settings-item-subtitle">CSV or JSON for spreadsheets</div>
            </div>
          </div>
          <div class="settings-item" id="import-btn">
            <div class="settings-item-icon">📤</div>
            <div class="settings-item-content">
              <div class="settings-item-title">Import Expenses</div>
              <div class="settings-item-subtitle">Add from JSON file</div>
            </div>
          </div>
        </div>
        <input type="file" id="import-file" accept=".json" style="display:none">
        <input type="file" id="restore-file" accept=".json" style="display:none">
      </div>
      
      <div class="settings-section">
        <div class="settings-list danger">
          <div class="settings-item" id="clear-data-btn">
            <div class="settings-item-content">
              <div class="settings-item-title danger">Clear Account Data</div>
            </div>
          </div>
          ${accounts.length > 1 ? `
          <div class="settings-item" id="delete-account-btn">
            <div class="settings-item-content">
              <div class="settings-item-title danger">Delete This Account</div>
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    `;
    
    // Account selection
    document.querySelectorAll('.settings-item[data-id]').forEach(item => {
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
    
    // Currency
    document.getElementById('currency-item').onclick = () => this.showCurrencyModal();
    
    // Budget
    document.getElementById('budget-item').onclick = () => this.showBudgetModal();
    
    // Dark mode toggle
    document.getElementById('dark-mode-toggle').onchange = (e) => {
      Settings.setDarkMode(e.target.checked);
      document.querySelector('#dark-mode-item .settings-item-subtitle').textContent = 
        e.target.checked ? 'On' : 'Off';
    };
    
    // Full backup
    document.getElementById('full-backup-btn').onclick = () => Settings.createFullBackup();
    
    // Restore backup
    document.getElementById('restore-backup-btn').onclick = () => {
      document.getElementById('restore-file').click();
    };
    document.getElementById('restore-file').onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await Settings.restoreFromBackup(file);
      }
      e.target.value = '';
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

  showCurrencyModal() {
    const currentCurrency = Accounts.getCurrentAccount()?.currency || '$';
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <button class="sheet-cancel" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <span class="sheet-title">Currency</span>
          <span></span>
        </div>
        <div class="sheet-body" style="padding:0">
          <div class="settings-list">
            ${Settings.currencies.map(c => `
              <div class="settings-item currency-option" data-currency="${c.symbol}">
                <div class="settings-item-content">
                  <div class="settings-item-title">${c.symbol} - ${c.name}</div>
                </div>
                ${c.symbol === currentCurrency ? '<span class="settings-item-check">✓</span>' : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelectorAll('.currency-option').forEach(item => {
      item.onclick = () => {
        const currency = item.dataset.currency;
        Accounts.updateAccount(Accounts.currentAccountId, { currency });
        Settings.setCurrency(currency);
        modal.remove();
        this.renderSettings();
        App.showSuccess('Currency updated');
      };
    });
    
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  },

  showBudgetModal() {
    const currentBudget = Settings.getBudget();
    const currency = Settings.getCurrency();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <button class="sheet-cancel" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <span class="sheet-title">Monthly Budget</span>
          <button class="sheet-save" id="save-budget-btn">Save</button>
        </div>
        <div class="sheet-body">
          <div class="input-group">
            <label>Budget Amount</label>
            <div style="display:flex;align-items:center;gap:8px;padding:8px 16px 14px">
              <span style="font-size:20px;color:#075e54">${currency}</span>
              <input type="number" id="budget-amount" value="${currentBudget || ''}" placeholder="0.00" step="0.01" inputmode="decimal" style="flex:1;padding:0;border:none;font-size:24px;font-weight:600">
            </div>
          </div>
          <p style="font-size:13px;color:#667781;padding:0 16px">Set a monthly spending limit. You'll see a progress bar on the home screen when a budget is set. Set to 0 or leave empty to disable.</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => document.getElementById('budget-amount').focus(), 100);
    
    document.getElementById('save-budget-btn').onclick = () => {
      const amount = parseFloat(document.getElementById('budget-amount').value) || 0;
      Settings.setBudget(amount);
      modal.remove();
      this.renderSettings();
      App.showSuccess(amount > 0 ? 'Budget set!' : 'Budget disabled');
    };
    
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
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

  exportData() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <button class="sheet-cancel" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <span class="sheet-title">Export Data</span>
          <span></span>
        </div>
        <div class="sheet-body" style="padding:0">
          <div class="settings-list">
            <div class="settings-item" id="export-csv">
              <div class="settings-item-icon">📊</div>
              <div class="settings-item-content">
                <div class="settings-item-title">Export as CSV</div>
                <div class="settings-item-subtitle">Spreadsheet format (Excel, Google Sheets)</div>
              </div>
            </div>
            <div class="settings-item" id="export-json">
              <div class="settings-item-icon">💾</div>
              <div class="settings-item-content">
                <div class="settings-item-title">Export as JSON</div>
                <div class="settings-item-subtitle">Full backup for restore</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#export-csv').onclick = async () => {
      modal.remove();
      await this.exportCSV();
    };
    
    modal.querySelector('#export-json').onclick = async () => {
      modal.remove();
      await this.exportJSON();
    };
    
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  },

  async exportCSV() {
    try {
      const expenses = await DB.getAllExpenses();
      const people = await DB.getPeople();
      const peopleMap = {};
      people.forEach(p => peopleMap[p.id] = p.name);

      // CSV header
      let csv = 'Date,Description,Amount,Paid By,Split Type\n';
      
      // Add rows
      for (const exp of expenses) {
        const date = exp.date;
        const desc = `"${(exp.description || '').replace(/"/g, '""')}"`;
        const amount = parseFloat(exp.amount).toFixed(2);
        const payer = peopleMap[exp.payerId] || 'Self';
        const split = exp.splitType || 'equal';
        
        csv += `${date},${desc},${amount},${payer},${split}\n`;
      }

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      App.showSuccess('Exported to CSV');
    } catch (e) {
      console.error('Export failed:', e);
      App.showError('Export failed');
    }
  },

  async exportJSON() {
    try {
      const data = await DB.getAllData();
      const account = Accounts.getCurrentAccount();
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        accountName: account?.name || 'Unknown',
        settings: {
          currency: account?.currency || '$',
          mode: account?.mode || 'shared'
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
      
      App.showSuccess('Exported to JSON');
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
