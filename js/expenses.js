/**
 * Expense Management Module
 */

const Expenses = {
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  thumbnailUrls: [], // Track object URLs for cleanup
  selectionMode: false,
  selectedIds: new Set(),
  newExpenseId: null, // Track newly added expense for animation
  currentCategoryFilter: 'all',
  
  // Pagination for large lists
  PAGE_SIZE: 50,
  currentPage: 0,
  allExpenses: [],
  hasMore: false,

  // Category detection keywords and icons
  categories: {
    '☕': ['coffee', 'cafe', 'starbucks', 'tim hortons', 'latte', 'espresso', 'tea'],
    '🍔': ['food', 'lunch', 'dinner', 'breakfast', 'meal', 'restaurant', 'pizza', 'burger', 'snack', 'eat', 'bar', 'pub'],
    '🍺': ['drink', 'drinks', 'beer', 'wine', 'alcohol', 'cocktail'],
    '🛒': ['grocery', 'groceries', 'supermarket', 'market', 'shopping', 'store', 'walmart', 'costco', 'target'],
    '🚗': ['gas', 'fuel', 'petrol', 'uber', 'lyft', 'taxi', 'car', 'parking', 'toll', 'transport', 'bus', 'train', 'metro', 'subway'],
    '✈️': ['flight', 'airline', 'airport', 'travel', 'trip', 'hotel', 'airbnb', 'booking', 'vacation'],
    '🏠': ['rent', 'mortgage', 'utilities', 'electric', 'electricity', 'water', 'internet', 'wifi', 'cable', 'home'],
    '📱': ['phone', 'mobile', 'cell', 'data', 'subscription', 'netflix', 'spotify', 'apple', 'google'],
    '🏥': ['doctor', 'hospital', 'medical', 'medicine', 'pharmacy', 'health', 'dental', 'dentist', 'insurance'],
    '🎬': ['movie', 'cinema', 'theater', 'concert', 'show', 'ticket', 'entertainment', 'game', 'sport'],
    '👕': ['clothes', 'clothing', 'shoes', 'fashion', 'dress', 'shirt', 'pants', 'jacket'],
    '🎁': ['gift', 'present', 'birthday', 'christmas', 'holiday'],
    '📚': ['book', 'books', 'education', 'course', 'class', 'school', 'tuition'],
    '💇': ['haircut', 'salon', 'spa', 'beauty', 'grooming'],
    '🐕': ['pet', 'dog', 'cat', 'vet', 'veterinary'],
    '💡': ['bill', 'bills', 'utility', 'payment']
  },

  // Get category icon based on description
  getCategoryIcon(description) {
    const desc = description.toLowerCase();
    for (const [icon, keywords] of Object.entries(this.categories)) {
      if (keywords.some(keyword => desc.includes(keyword))) {
        return icon;
      }
    }
    return '💵'; // Default
  },

  async init() {
    // Nothing needed
  },

  async loadCurrentMonth() {
    // Show skeleton while loading
    this.showSkeleton();
    
    try {
      const expenses = await DB.getExpenses(this.currentMonth, this.currentYear);
      
      // Apply category filter if active
      let filtered = expenses;
      if (this.currentCategoryFilter && this.currentCategoryFilter !== 'all') {
        filtered = expenses.filter(exp => {
          const icon = this.getCategoryIcon(exp.description);
          return icon === this.currentCategoryFilter;
        });
      }
      
      // Store all expenses for pagination
      this.allExpenses = filtered;
      this.currentPage = 0;
      this.hasMore = filtered.length > this.PAGE_SIZE;
      
      // Render first page
      const firstPage = filtered.slice(0, this.PAGE_SIZE);
      this.renderExpenses(firstPage, false);
      this.updateMonthDisplay();
      this.updateSummary(filtered);
      
      // Setup infinite scroll
      this.setupInfiniteScroll();
    } catch (e) {
      console.error('Failed to load expenses:', e);
    }
  },
  
  setupInfiniteScroll() {
    const scrollContainer = document.querySelector('.page-scroll-content');
    if (!scrollContainer) return;
    
    // Remove old listener
    scrollContainer.removeEventListener('scroll', this.handleScroll);
    
    // Add new listener
    this.handleScroll = () => {
      if (!this.hasMore) return;
      
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      if (scrollTop + clientHeight >= scrollHeight - 200) {
        this.loadMoreExpenses();
      }
    };
    
    scrollContainer.addEventListener('scroll', this.handleScroll, { passive: true });
  },
  
  loadMoreExpenses() {
    if (!this.hasMore) return;
    
    this.currentPage++;
    const start = this.currentPage * this.PAGE_SIZE;
    const end = start + this.PAGE_SIZE;
    const nextPage = this.allExpenses.slice(start, end);
    
    if (nextPage.length === 0) {
      this.hasMore = false;
      return;
    }
    
    this.hasMore = end < this.allExpenses.length;
    this.appendExpenses(nextPage);
  },
  
  appendExpenses(expenses) {
    const list = document.getElementById('expenses-list');
    if (!list) return;
    
    const currency = Settings.getCurrency();
    const people = People.list || [];
    const peopleMap = {};
    people.forEach(p => peopleMap[p.id] = p.name);
    
    let html = '';
    for (const exp of expenses) {
      const icon = this.getCategoryIcon(exp.description);
      const payerName = peopleMap[exp.payerId] || '';
      const dateDisplay = this.formatDateShort(exp.date);
      const isRecurring = exp.recurring;
      const hasImage = exp.imageId;
      const syncStatus = exp.syncStatus || 'pending';
      
      html += `
        <div class="expense-item-wrapper">
          <div class="expense-item" data-id="${exp.id}" onclick="Expenses.handleItemClick('${exp.id}')">
            ${hasImage ? 
              `<div class="expense-thumb" data-img="${exp.imageId}"></div>` :
              `<div class="expense-icon">${icon}</div>`
            }
            <div class="expense-main">
              <div class="expense-desc">${UI.escapeHtml(exp.description)}</div>
              <div class="expense-meta">${dateDisplay}${payerName ? ' • ' + payerName : ''}${isRecurring ? ' • 🔄' : ''}${hasImage ? ' • 📎' : ''}</div>
            </div>
            <div class="expense-amount">${currency}${parseFloat(exp.amount).toFixed(2)}</div>
            <div class="sync-indicator ${syncStatus}"></div>
          </div>
          <div class="swipe-actions">
            <button class="swipe-action swipe-duplicate" onclick="Expenses.duplicateExpense('${exp.id}')">
              <span>📋</span>
              <span>Copy</span>
            </button>
            <button class="swipe-action swipe-delete" onclick="Expenses.deleteExpense('${exp.id}')">
              <span>🗑️</span>
              <span>Delete</span>
            </button>
          </div>
        </div>
      `;
    }
    
    // Append to list
    list.insertAdjacentHTML('beforeend', html);
    
    // Load thumbnails for new items
    this.loadThumbnails();
    this.setupSwipeHandlers();
    
    // Setup long press for new items
    document.querySelectorAll('.expense-item:not([data-longpress])').forEach(item => {
      const id = item.dataset.id;
      if (id) {
        this.setupLongPress(item, id);
        item.dataset.longpress = 'true';
      }
    });
  },

  showSkeleton() {
    const list = document.getElementById('expenses-list');
    if (!list) return;
    
    list.innerHTML = Array(5).fill(0).map(() => `
      <div class="expense-item skeleton">
        <div class="skeleton-icon"></div>
        <div class="expense-main">
          <div class="skeleton-text skeleton-title"></div>
          <div class="skeleton-text skeleton-meta"></div>
        </div>
        <div class="skeleton-text skeleton-amount"></div>
      </div>
    `).join('');
  },

  async renderExpenses(expenses) {
    const list = document.getElementById('expenses-list');
    if (!list) return;

    if (expenses.length === 0) {
      const isFiltered = this.currentCategoryFilter && this.currentCategoryFilter !== 'all';
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-illustration">
            ${isFiltered ? '🔍' : '💰'}
          </div>
          <div class="empty-title">${isFiltered ? 'No matching expenses' : 'No expenses yet'}</div>
          <div class="empty-text">${isFiltered ? 'Try a different category filter' : 'Track your spending by adding your first expense'}</div>
          ${!isFiltered ? `
          <div class="empty-tips">
            <div class="empty-tip">📷 Snap a receipt to auto-fill</div>
            <div class="empty-tip">🔄 Set up recurring expenses</div>
            <div class="empty-tip">👥 Split costs with others</div>
          </div>
          <button class="btn-primary empty-cta" onclick="App.navigateTo('add')">Add First Expense</button>
          ` : ''}
        </div>
      `;
      return;
    }

    // Get people names
    const people = await DB.getPeople();
    const names = {};
    people.forEach(p => names[p.id] = p.name);

    // Sort by date descending (newest first)
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Group expenses by date category
    const grouped = this.groupByDateCategory(expenses);
    
    let html = '';
    for (const group of grouped) {
      // Add date separator
      html += `
        <div class="date-separator">
          <span class="date-separator-text">${group.label}</span>
          <span class="date-separator-total">${Settings.formatAmount(group.total)}</span>
        </div>
      `;
      
      // Add expenses in this group
      for (const exp of group.expenses) {
        const payerName = Accounts.isSharedMode() ? `${names[exp.payerId] || 'Unknown'} • ` : '';
        const categoryIcon = this.getCategoryIcon(exp.description);
        const isSelected = this.selectedIds.has(exp.id);
        const isNew = this.newExpenseId === exp.id;
        const syncStatus = exp.syncStatus || 'pending';
        const showSyncStatus = Accounts.isSharedMode();
        
        html += `
          <div class="expense-item-wrapper ${isNew ? 'new-entry' : ''}" data-id="${exp.id}">
            <div class="expense-item ${isSelected ? 'selected' : ''}" 
                 onclick="Expenses.handleItemClick('${exp.id}')" 
                 oncontextmenu="Expenses.toggleSelectionMode(event, '${exp.id}')">
              ${this.selectionMode ? `
                <div class="expense-checkbox ${isSelected ? 'checked' : ''}">
                  ${isSelected ? '✓' : ''}
                </div>
              ` : (exp.imageId ? `<div class="expense-thumb" data-img="${exp.imageId}"></div>` : `<div class="expense-icon">${categoryIcon}</div>`)}
              <div class="expense-main">
                <div class="expense-desc">${exp.description}${showSyncStatus ? `<span class="sync-indicator ${syncStatus}" title="${syncStatus === 'synced' ? 'Synced' : 'Pending sync'}"></span>` : ''}</div>
                <div class="expense-meta">${payerName}${this.formatDateShort(exp.date)}${exp.tags ? ` • ${exp.tags}` : ''}${exp.isRecurring ? ' • 🔄' : ''}${exp.imageId ? ' • 📎' : ''}</div>
              </div>
              <div class="expense-amount">${Settings.formatAmount(exp.amount)}</div>
            </div>
            <div class="swipe-actions">
              <button class="swipe-action swipe-duplicate" onclick="Expenses.duplicateExpense('${exp.id}')">
                <span>📋</span>
                <span>Copy</span>
              </button>
              <button class="swipe-action swipe-delete" onclick="Expenses.deleteExpense('${exp.id}')">
                <span>🗑️</span>
                <span>Delete</span>
              </button>
            </div>
          </div>
        `;
      }
    }
    
    list.innerHTML = html;
    
    // Clear new expense flag after animation
    if (this.newExpenseId) {
      setTimeout(() => { this.newExpenseId = null; }, 600);
    }

    // Load thumbnails and setup swipe
    this.loadThumbnails();
    this.setupSwipeHandlers();
    
    // Setup long press for context menu
    document.querySelectorAll('.expense-item').forEach(item => {
      const id = item.dataset.id;
      if (id) this.setupLongPress(item, id);
    });
  },

  // Group expenses by date category (Today, Yesterday, This Week, Earlier)
  groupByDateCategory(expenses) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const groups = {
      today: { label: 'Today', expenses: [], total: 0 },
      yesterday: { label: 'Yesterday', expenses: [], total: 0 },
      thisWeek: { label: 'This Week', expenses: [], total: 0 },
      earlier: { label: 'Earlier', expenses: [], total: 0 }
    };
    
    for (const exp of expenses) {
      const expDate = new Date(exp.date);
      expDate.setHours(0, 0, 0, 0);
      const amount = parseFloat(exp.amount);
      
      if (expDate.getTime() === today.getTime()) {
        groups.today.expenses.push(exp);
        groups.today.total += amount;
      } else if (expDate.getTime() === yesterday.getTime()) {
        groups.yesterday.expenses.push(exp);
        groups.yesterday.total += amount;
      } else if (expDate > weekAgo) {
        groups.thisWeek.expenses.push(exp);
        groups.thisWeek.total += amount;
      } else {
        groups.earlier.expenses.push(exp);
        groups.earlier.total += amount;
      }
    }
    
    // Return only non-empty groups
    return Object.values(groups).filter(g => g.expenses.length > 0);
  },

  // Shorter date format for list (since we have separators)
  formatDateShort(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expDate = new Date(date);
    expDate.setHours(0, 0, 0, 0);
    
    // If today or yesterday, just show time
    if (expDate.getTime() === today.getTime() || 
        expDate.getTime() === today.getTime() - 86400000) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    
    // Otherwise show day name or date
    const daysDiff = Math.floor((today - expDate) / 86400000);
    if (daysDiff < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  setupSwipeHandlers() {
    if (this.selectionMode) return;
    
    const wrappers = document.querySelectorAll('.expense-item-wrapper');
    wrappers.forEach(wrapper => {
      const item = wrapper.querySelector('.expense-item');
      let startX = 0;
      let startY = 0;
      let currentX = 0;
      let isDragging = false;
      let isHorizontalSwipe = null;

      item.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isDragging = true;
        isHorizontalSwipe = null;
        item.style.transition = 'none';
      }, { passive: true });

      item.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        
        currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - startX;
        const diffY = currentY - startY;
        
        // Determine swipe direction on first significant move
        if (isHorizontalSwipe === null && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
          isHorizontalSwipe = Math.abs(diffX) > Math.abs(diffY);
        }
        
        // Only handle horizontal swipes
        if (isHorizontalSwipe && diffX < 0) {
          const translateX = Math.max(diffX * 0.8, -150); // Add resistance
          item.style.transform = `translateX(${translateX}px)`;
        }
      }, { passive: true });

      item.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        item.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        
        const diff = currentX - startX;
        if (isHorizontalSwipe && diff < -60) {
          // Show actions with haptic
          item.style.transform = 'translateX(-150px)';
          wrapper.classList.add('swiped');
          this.hapticFeedback('light');
          
          // Close other open swipes
          document.querySelectorAll('.expense-item-wrapper.swiped').forEach(w => {
            if (w !== wrapper) {
              w.classList.remove('swiped');
              w.querySelector('.expense-item').style.transform = 'translateX(0)';
            }
          });
        } else {
          // Reset with spring animation
          item.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
          item.style.transform = 'translateX(0)';
          wrapper.classList.remove('swiped');
        }
        currentX = 0;
        isHorizontalSwipe = null;
      });

      // Close on tap elsewhere
      item.addEventListener('click', (e) => {
        if (wrapper.classList.contains('swiped')) {
          e.stopPropagation();
          item.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          item.style.transform = 'translateX(0)';
          wrapper.classList.remove('swiped');
        }
      });
    });
  },

  async loadThumbnails() {
    // Revoke previous URLs to prevent memory leaks
    this.revokeThumbnailUrls();
    
    const thumbs = document.querySelectorAll('.expense-thumb[data-img]');
    for (const thumb of thumbs) {
      const imgId = thumb.dataset.img;
      try {
        const img = await DB.getImage(imgId);
        if (img && img.thumbnail) {
          const url = URL.createObjectURL(img.thumbnail);
          this.thumbnailUrls.push(url);
          thumb.style.backgroundImage = `url(${url})`;
        }
      } catch (e) {}
    }
  },

  revokeThumbnailUrls() {
    for (const url of this.thumbnailUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
    }
    this.thumbnailUrls = [];
  },

  // Track double tap
  lastTapTime: 0,
  lastTapId: null,

  handleItemClick(id) {
    if (this.selectionMode) {
      this.toggleSelection(id);
      return;
    }
    
    // Double tap detection
    const now = Date.now();
    if (this.lastTapId === id && now - this.lastTapTime < 300) {
      // Double tap - edit
      this.hapticFeedback('light');
      this.editExpense(id);
      this.lastTapTime = 0;
      this.lastTapId = null;
      return;
    }
    
    this.lastTapTime = now;
    this.lastTapId = id;
    
    // Single tap - show detail after delay
    setTimeout(() => {
      if (this.lastTapId === id) {
        this.showDetail(id);
        this.lastTapId = null;
      }
    }, 300);
  },

  // Long press context menu
  setupLongPress(element, id) {
    let pressTimer;
    let longPressed = false;
    
    element.addEventListener('touchstart', (e) => {
      longPressed = false;
      pressTimer = setTimeout(() => {
        longPressed = true;
        this.hapticFeedback('medium');
        this.showContextMenu(e, id);
      }, 500);
    }, { passive: true });
    
    element.addEventListener('touchend', () => {
      clearTimeout(pressTimer);
    });
    
    element.addEventListener('touchmove', () => {
      clearTimeout(pressTimer);
    });
  },

  showContextMenu(event, id) {
    // Remove existing menu
    document.querySelector('.context-menu')?.remove();
    document.querySelector('.context-menu-backdrop')?.remove();
    
    const touch = event.touches?.[0] || event;
    const x = Math.min(touch.clientX, window.innerWidth - 200);
    const y = Math.min(touch.clientY, window.innerHeight - 250);
    
    const backdrop = document.createElement('div');
    backdrop.className = 'context-menu-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:9999';
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.innerHTML = `
      <button class="context-menu-item" data-action="edit">
        <span class="context-menu-icon">✏️</span>
        <span>Edit</span>
      </button>
      <button class="context-menu-item" data-action="duplicate">
        <span class="context-menu-icon">📋</span>
        <span>Duplicate</span>
      </button>
      <button class="context-menu-item" data-action="share">
        <span class="context-menu-icon">📤</span>
        <span>Share</span>
      </button>
      <button class="context-menu-item danger" data-action="delete">
        <span class="context-menu-icon">🗑️</span>
        <span>Delete</span>
      </button>
    `;
    
    document.body.appendChild(backdrop);
    document.body.appendChild(menu);
    
    backdrop.onclick = () => {
      menu.remove();
      backdrop.remove();
    };
    
    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.onclick = async () => {
        const action = item.dataset.action;
        menu.remove();
        backdrop.remove();
        
        switch (action) {
          case 'edit':
            this.editExpense(id);
            break;
          case 'duplicate':
            await this.duplicateExpense(id);
            break;
          case 'share':
            await this.shareExpense(id);
            break;
          case 'delete':
            await this.deleteExpense(id);
            break;
        }
      };
    });
  },

  // Share expense via native share API
  async shareExpense(id) {
    const expense = await DB.getExpense(id);
    if (!expense) return;
    
    const currency = Settings.getCurrency();
    const text = `${expense.description}: ${currency}${expense.amount.toFixed(2)} on ${expense.date}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Expense',
          text: text
        });
      } catch (e) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(text);
        App.showSuccess('Copied to clipboard');
      } catch (e) {
        App.showError('Could not share');
      }
    }
  },

  toggleSelectionMode(event, id) {
    event.preventDefault();
    if (!this.selectionMode) {
      this.selectionMode = true;
      this.selectedIds.clear();
      this.selectedIds.add(id);
      this.showSelectionBar();
      this.loadCurrentMonth();
    }
  },

  toggleSelection(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    
    // Update UI
    const item = document.querySelector(`.expense-item[data-id="${id}"]`);
    if (item) {
      item.classList.toggle('selected', this.selectedIds.has(id));
      const checkbox = item.querySelector('.expense-checkbox');
      if (checkbox) {
        checkbox.classList.toggle('checked', this.selectedIds.has(id));
        checkbox.textContent = this.selectedIds.has(id) ? '✓' : '';
      }
    }
    
    this.updateSelectionBar();
    
    // Exit selection mode if nothing selected
    if (this.selectedIds.size === 0) {
      this.exitSelectionMode();
    }
  },

  showSelectionBar() {
    // Remove existing bar
    document.querySelector('.selection-bar')?.remove();
    
    const isShared = Accounts.isSharedMode();
    
    const bar = document.createElement('div');
    bar.className = 'selection-bar';
    bar.innerHTML = `
      <button class="selection-cancel" onclick="Expenses.exitSelectionMode()">Cancel</button>
      <span class="selection-count">${this.selectedIds.size} selected</span>
      <div class="selection-actions">
        ${isShared ? '<button class="selection-action" onclick="Expenses.bulkChangePayer()">👤</button>' : ''}
        <button class="selection-action" onclick="Expenses.bulkChangeCategory()">🏷️</button>
        <button class="selection-delete" onclick="Expenses.deleteSelected()">🗑️</button>
      </div>
    `;
    document.body.appendChild(bar);
  },

  updateSelectionBar() {
    const countEl = document.querySelector('.selection-count');
    if (countEl) {
      countEl.textContent = `${this.selectedIds.size} selected`;
    }
  },

  exitSelectionMode() {
    this.selectionMode = false;
    this.selectedIds.clear();
    document.querySelector('.selection-bar')?.remove();
    this.loadCurrentMonth();
  },

  async deleteSelected() {
    if (this.selectedIds.size === 0) return;
    
    const count = this.selectedIds.size;
    if (!confirm(`Delete ${count} expense${count > 1 ? 's' : ''}?`)) return;
    
    App.showLoading('Deleting...');
    try {
      for (const id of this.selectedIds) {
        await DB.deleteExpense(id);
      }
      App.hideLoading();
      App.showSuccess(`Deleted ${count} expense${count > 1 ? 's' : ''}`);
      this.exitSelectionMode();
    } catch (e) {
      App.hideLoading();
      console.error('Failed to delete:', e);
      App.showError('Failed to delete some expenses');
    }
  },

  // Bulk change payer for selected expenses
  async bulkChangePayer() {
    if (this.selectedIds.size === 0) return;
    
    const people = await DB.getPeople();
    if (people.length === 0) {
      App.showError('No people added');
      return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <button class="sheet-cancel" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <span class="sheet-title">Change Payer</span>
          <span></span>
        </div>
        <div class="sheet-body">
          <p style="margin-bottom:16px;color:var(--text-secondary)">
            Change payer for ${this.selectedIds.size} expense${this.selectedIds.size > 1 ? 's' : ''}:
          </p>
          <div class="payer-options">
            ${people.map(p => `
              <button class="payer-option" data-id="${p.id}">
                <span class="payer-avatar">${p.name.charAt(0).toUpperCase()}</span>
                <span class="payer-name">${p.name}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelectorAll('.payer-option').forEach(btn => {
      btn.onclick = async () => {
        const payerId = btn.dataset.id;
        modal.remove();
        
        App.showLoading('Updating...');
        try {
          for (const id of this.selectedIds) {
            await DB.updateExpense(id, { payerId });
          }
          App.hideLoading();
          App.showSuccess('Payer updated');
          this.exitSelectionMode();
        } catch (e) {
          App.hideLoading();
          App.showError('Failed to update');
        }
      };
    });
    
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  },

  // Bulk change category (via description prefix)
  async bulkChangeCategory() {
    if (this.selectedIds.size === 0) return;
    
    const categories = [
      { icon: '🍔', name: 'Food' },
      { icon: '☕', name: 'Coffee' },
      { icon: '🛒', name: 'Shopping' },
      { icon: '🚗', name: 'Transport' },
      { icon: '🏠', name: 'Home' },
      { icon: '🎬', name: 'Entertainment' },
      { icon: '🏥', name: 'Health' },
      { icon: '💵', name: 'Other' }
    ];
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <button class="sheet-cancel" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <span class="sheet-title">Add Tag</span>
          <span></span>
        </div>
        <div class="sheet-body">
          <p style="margin-bottom:16px;color:var(--text-secondary)">
            Add tag to ${this.selectedIds.size} expense${this.selectedIds.size > 1 ? 's' : ''}:
          </p>
          <div class="category-grid">
            ${categories.map(c => `
              <button class="category-option" data-tag="${c.name}">
                <span class="category-emoji">${c.icon}</span>
                <span class="category-name">${c.name}</span>
              </button>
            `).join('')}
          </div>
          <div class="form-group" style="margin-top:16px">
            <label>Or enter custom tag:</label>
            <input type="text" id="custom-tag" placeholder="e.g., vacation, work">
          </div>
          <button class="btn-primary" id="apply-custom-tag" style="margin-top:12px">Apply Custom Tag</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const applyTag = async (tag) => {
      modal.remove();
      
      App.showLoading('Updating...');
      try {
        for (const id of this.selectedIds) {
          const exp = await DB.getExpenseById(id);
          if (exp) {
            const currentTags = exp.tags || '';
            const newTags = currentTags ? `${currentTags}, ${tag}` : tag;
            await DB.updateExpense(id, { tags: newTags });
          }
        }
        App.hideLoading();
        App.showSuccess('Tags updated');
        this.exitSelectionMode();
      } catch (e) {
        App.hideLoading();
        App.showError('Failed to update');
      }
    };
    
    modal.querySelectorAll('.category-option').forEach(btn => {
      btn.onclick = () => applyTag(btn.dataset.tag);
    });
    
    modal.querySelector('#apply-custom-tag').onclick = () => {
      const tag = modal.querySelector('#custom-tag').value.trim();
      if (tag) {
        applyTag(tag);
      } else {
        App.showError('Enter a tag');
      }
    };
    
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  },

  async duplicateExpense(id) {
    try {
      const exp = await DB.getExpenseById(id);
      if (!exp) return;
      
      // Create new expense with today's date
      const newExpense = {
        description: exp.description,
        amount: exp.amount,
        date: new Date().toISOString().split('T')[0],
        payerId: exp.payerId,
        splitType: exp.splitType || 'equal',
        splitDetails: exp.splitDetails,
        tags: exp.tags || '',
        notes: exp.notes || ''
        // Don't copy imageId, recurring, or syncId
      };
      
      await DB.addExpense(newExpense);
      this.hapticFeedback();
      App.showSuccess('Expense copied!');
      this.loadCurrentMonth();
    } catch (e) {
      console.error('Failed to duplicate:', e);
      App.showError('Failed to copy expense');
    }
  },

  hapticFeedback(type = 'light') {
    App.haptic(type);
  },

  async showDetail(id) {
    const exp = await DB.getExpenseById(id);
    if (!exp) return;

    const people = await DB.getPeople();
    const payer = people.find(p => p.id === exp.payerId);
    const isShared = Accounts.isSharedMode();

    let imageHtml = '';
    if (exp.imageId) {
      try {
        const img = await DB.getImage(exp.imageId);
        if (img && img.blob) {
          const url = URL.createObjectURL(img.blob);
          imageHtml = `<div class="detail-image"><img src="${url}" onclick="Expenses.showFullImage('${exp.imageId}')"></div>`;
        }
      } catch (e) {}
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <span>Expense Detail</span>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          ${imageHtml}
          <div class="detail-row">
            <span class="detail-label">Description</span>
            <span class="detail-value">${exp.description}${exp.recurring ? ' 🔄' : ''}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Amount</span>
            <span class="detail-value detail-amount">${Settings.formatAmount(exp.amount)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date</span>
            <span class="detail-value">${this.formatDateFull(exp.date)}</span>
          </div>
          ${isShared ? `
          <div class="detail-row">
            <span class="detail-label">Paid By</span>
            <span class="detail-value">${payer?.name || 'Unknown'}</span>
          </div>
          ` : ''}
          ${exp.recurring ? `
          <div class="detail-row">
            <span class="detail-label">Type</span>
            <span class="detail-value">Recurring monthly</span>
          </div>
          ` : ''}
          ${exp.tags ? `
          <div class="detail-row">
            <span class="detail-label">Tags</span>
            <span class="detail-value">${exp.tags}</span>
          </div>
          ` : ''}
          ${exp.notes ? `
          <div class="detail-row detail-notes">
            <span class="detail-label">Notes</span>
            <span class="detail-value">${exp.notes}</span>
          </div>
          ` : ''}
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="Expenses.editExpense('${exp.id}'); this.closest('.modal-overlay').remove();">Edit</button>
          <button class="btn-danger" onclick="Expenses.deleteExpense('${exp.id}'); this.closest('.modal-overlay').remove();">Delete</button>
        </div>
      </div>
    `;

    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    document.body.appendChild(modal);
  },

  async editExpense(id) {
    const exp = await DB.getExpenseById(id);
    if (!exp) return;

    const isShared = Accounts.isSharedMode();
    const people = await DB.getPeople();
    const peopleOptions = people.map(p => 
      `<option value="${p.id}" ${p.id === exp.payerId ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    // Track image state for editing
    let currentImageId = exp.imageId;
    let newImageId = null;

    // Get existing image preview if any
    let imagePreviewHtml = '';
    if (exp.imageId) {
      try {
        const img = await DB.getImage(exp.imageId);
        if (img && img.thumbnail) {
          const url = URL.createObjectURL(img.thumbnail);
          imagePreviewHtml = `
            <div id="edit-image-preview" style="display:flex;align-items:center;gap:12px;padding:12px;background:#f0f2f5;border-radius:10px;margin-bottom:12px">
              <img src="${url}" style="width:56px;height:56px;object-fit:cover;border-radius:8px" alt="Receipt">
              <span style="flex:1;font-size:14px;color:#667781">📎 Receipt attached</span>
              <button type="button" id="edit-remove-image" style="padding:8px 14px;font-size:13px;background:#fff;border:1px solid #e9edef;border-radius:8px;color:#ff3b30;cursor:pointer">Remove</button>
            </div>
          `;
        }
      } catch (e) {}
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <button class="sheet-cancel" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <span class="sheet-title">Edit Expense</span>
          <button class="sheet-save" id="update-expense-btn">Save</button>
        </div>
        <div class="sheet-body">
          <div class="input-group">
            <label>Description</label>
            <input type="text" id="edit-description" value="${exp.description}">
          </div>
          <div class="input-group">
            <label>Amount</label>
            <input type="number" id="edit-amount" value="${exp.amount}" step="0.01" inputmode="decimal">
          </div>
          <div class="input-group">
            <label>Date</label>
            <input type="date" id="edit-date" value="${exp.date}">
          </div>
          ${isShared ? `
          <div class="input-group">
            <label>Paid By</label>
            <select id="edit-payer">${peopleOptions}</select>
          </div>
          ` : ''}
          <div class="input-group" style="background:transparent;padding:0">
            <label style="padding:12px 0 8px">Receipt Photo</label>
            <div id="edit-image-container">
              ${imagePreviewHtml}
            </div>
            <div id="edit-photo-buttons" style="display:flex;gap:12px;${exp.imageId ? 'display:none' : ''}">
              <button type="button" id="edit-capture-photo" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 12px;background:#f0f2f5;border:none;border-radius:12px;font-size:14px;cursor:pointer">
                <span style="font-size:24px">📷</span>
                <span>Take Photo</span>
              </button>
              <button type="button" id="edit-choose-photo" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 12px;background:#f0f2f5;border:none;border-radius:12px;font-size:14px;cursor:pointer">
                <span style="font-size:24px">🖼️</span>
                <span>Gallery</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Handle remove image
    const removeBtn = modal.querySelector('#edit-remove-image');
    if (removeBtn) {
      removeBtn.onclick = () => {
        currentImageId = null;
        modal.querySelector('#edit-image-container').innerHTML = '';
        modal.querySelector('#edit-photo-buttons').style.display = 'flex';
      };
    }

    // Handle photo capture/selection for edit
    const setupPhotoHandler = (imageData) => {
      newImageId = imageData.id;
      currentImageId = imageData.id;
      DB.getImage(imageData.id).then(img => {
        if (img && img.thumbnail) {
          const url = URL.createObjectURL(img.thumbnail);
          modal.querySelector('#edit-image-container').innerHTML = `
            <div id="edit-image-preview" style="display:flex;align-items:center;gap:12px;padding:12px;background:#f0f2f5;border-radius:10px;margin-bottom:12px">
              <img src="${url}" style="width:56px;height:56px;object-fit:cover;border-radius:8px" alt="Receipt">
              <span style="flex:1;font-size:14px;color:#667781">📎 Receipt attached</span>
              <button type="button" id="edit-remove-new-image" style="padding:8px 14px;font-size:13px;background:#fff;border:1px solid #e9edef;border-radius:8px;color:#ff3b30;cursor:pointer">Remove</button>
            </div>
          `;
          modal.querySelector('#edit-photo-buttons').style.display = 'none';
          
          // Setup remove handler for new image
          modal.querySelector('#edit-remove-new-image').onclick = () => {
            DB.deleteImage(newImageId);
            newImageId = null;
            currentImageId = null;
            modal.querySelector('#edit-image-container').innerHTML = '';
            modal.querySelector('#edit-photo-buttons').style.display = 'flex';
          };
        }
      });
    };

    modal.querySelector('#edit-capture-photo').onclick = async () => {
      // Store original handler
      const origCapturedImage = Camera.capturedImage;
      Camera.capturedImage = null;
      
      await Camera.capturePhoto();
      
      // Wait for photo capture and check
      const checkCapture = setInterval(() => {
        if (Camera.capturedImage) {
          clearInterval(checkCapture);
          setupPhotoHandler(Camera.capturedImage);
          Camera.capturedImage = origCapturedImage;
        }
      }, 200);
      
      // Stop checking after 30 seconds
      setTimeout(() => clearInterval(checkCapture), 30000);
    };

    modal.querySelector('#edit-choose-photo').onclick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/gif,image/webp';
      
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
          const compressed = await Camera.compressImage(file);
          const thumbnail = await Camera.createThumbnail(compressed);
          const imageData = await DB.saveImage(compressed, thumbnail);
          setupPhotoHandler(imageData);
          App.showSuccess('Photo added');
        } catch (error) {
          App.showError('Failed to add photo');
        }
      };
      
      input.click();
    };

    document.getElementById('update-expense-btn').onclick = async () => {
      const desc = document.getElementById('edit-description').value.trim();
      const amount = parseFloat(document.getElementById('edit-amount').value);
      const date = document.getElementById('edit-date').value;
      const payerId = isShared ? document.getElementById('edit-payer').value : exp.payerId;

      if (!desc || isNaN(amount) || amount <= 0 || !date) {
        App.showError('Fill all fields correctly');
        return;
      }

      try {
        // Delete old image if it was removed or replaced
        if (exp.imageId && exp.imageId !== currentImageId) {
          await DB.deleteImage(exp.imageId);
        }
        
        await DB.updateExpense(id, { 
          description: desc, 
          amount, 
          date, 
          payerId,
          imageId: currentImageId 
        });
        App.showSuccess('Updated!');
        modal.remove();
        this.loadCurrentMonth();
      } catch (e) {
        App.showError('Failed to update');
      }
    };

    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  },

  async showFullImage(imageId) {
    try {
      const img = await DB.getImage(imageId);
      if (!img || !img.blob) return;

      const url = URL.createObjectURL(img.blob);
      
      const viewer = document.createElement('div');
      viewer.className = 'image-viewer';
      viewer.innerHTML = `
        <div class="image-viewer-close" onclick="this.parentElement.remove()">×</div>
        <img src="${url}">
      `;
      
      viewer.onclick = (e) => {
        if (e.target === viewer) {
          URL.revokeObjectURL(url);
          viewer.remove();
        }
      };
      
      document.body.appendChild(viewer);
    } catch (e) {
      console.error('Failed to show image:', e);
    }
  },

  formatDate(dateStr) {
    // Parse YYYY-MM-DD without timezone issues
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  formatDateFull(dateStr) {
    // Parse YYYY-MM-DD without timezone issues
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString();
  },

  updateMonthDisplay() {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    
    const el = document.getElementById('current-month');
    if (el) {
      el.textContent = `${months[this.currentMonth]} ${this.currentYear}`;
    }
  },

  updateSummary(expenses) {
    const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    
    const totalEl = document.getElementById('total-amount');
    if (totalEl) totalEl.textContent = Settings.formatAmount(total);
    
    const countEl = document.getElementById('expense-count');
    if (countEl) countEl.textContent = `${expenses.length} expense${expenses.length !== 1 ? 's' : ''}`;
    
    // Update today's spending
    this.updateTodayStats(expenses);
    
    // Update budget progress
    const budgetEl = document.getElementById('budget-progress');
    if (budgetEl) {
      const budgetStatus = Settings.getBudgetStatus(total);
      if (budgetStatus) {
        budgetEl.classList.remove('hidden');
        const fill = budgetEl.querySelector('.budget-fill');
        const text = budgetEl.querySelector('.budget-text');
        
        fill.style.width = `${budgetStatus.percent}%`;
        fill.className = 'budget-fill ' + budgetStatus.status;
        
        if (budgetStatus.status === 'over') {
          text.textContent = `Over budget by ${Settings.formatAmount(-budgetStatus.remaining)}`;
        } else {
          text.textContent = `${Settings.formatAmount(budgetStatus.remaining)} left of ${Settings.formatAmount(budgetStatus.budget)}`;
        }
      } else {
        budgetEl.classList.add('hidden');
      }
    }
  },

  updateTodayStats(expenses) {
    const todayAmountEl = document.getElementById('today-amount');
    const todayTrendEl = document.getElementById('today-trend');
    if (!todayAmountEl) return;
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    // Calculate today's total
    const todayExpenses = expenses.filter(e => e.date === today);
    const todayTotal = todayExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    
    // Calculate yesterday's total
    const yesterdayExpenses = expenses.filter(e => e.date === yesterday);
    const yesterdayTotal = yesterdayExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    
    todayAmountEl.textContent = Settings.formatAmount(todayTotal);
    
    // Show trend
    if (todayTrendEl) {
      if (yesterdayTotal > 0 && todayTotal > 0) {
        const diff = todayTotal - yesterdayTotal;
        const percent = Math.round((diff / yesterdayTotal) * 100);
        
        if (diff > 0) {
          todayTrendEl.innerHTML = `<span class="trend-up">↑ ${Math.abs(percent)}%</span> vs yesterday`;
        } else if (diff < 0) {
          todayTrendEl.innerHTML = `<span class="trend-down">↓ ${Math.abs(percent)}%</span> vs yesterday`;
        } else {
          todayTrendEl.textContent = 'Same as yesterday';
        }
      } else if (todayTotal > 0) {
        todayTrendEl.textContent = `${todayExpenses.length} expense${todayExpenses.length !== 1 ? 's' : ''}`;
      } else {
        todayTrendEl.textContent = 'No spending yet';
      }
    }
  },

  navigateMonth(dir) {
    this.currentMonth += dir;
    
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }
    
    this.loadCurrentMonth();
  },

  async loadAllExpenses() {
    try {
      const expenses = await DB.getExpenses();
      this.renderExpenses(expenses);
      
      // Update summary label
      const label = document.querySelector('.summary-label');
      if (label) label.textContent = 'Total All Time';
      
      this.updateSummary(expenses);
    } catch (e) {
      console.error('Failed to load expenses:', e);
    }
  },

  async loadDateRange(from, to) {
    try {
      const allExpenses = await DB.getExpenses();
      const fromDate = new Date(from);
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59); // Include full end day
      
      const expenses = allExpenses.filter(e => {
        const date = new Date(e.date);
        return date >= fromDate && date <= toDate;
      });
      
      this.renderExpenses(expenses);
      
      // Update summary label
      const label = document.querySelector('.summary-label');
      if (label) label.textContent = `${this.formatDate(from)} - ${this.formatDate(to)}`;
      
      this.updateSummary(expenses);
    } catch (e) {
      console.error('Failed to load expenses:', e);
    }
  },

  async saveExpense() {
    const desc = document.getElementById('expense-description').value.trim();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const date = document.getElementById('expense-date').value;
    const payerId = document.getElementById('expense-payer').value;
    const imageId = Camera.capturedImage?.id || null;
    const splitType = document.getElementById('expense-split')?.value || 'equal';
    const recurring = document.getElementById('expense-recurring')?.value || '';
    const tags = document.getElementById('expense-tags')?.value.trim() || '';
    const notes = document.getElementById('expense-notes')?.value.trim() || '';

    // Validate amount
    if (!amount || amount <= 0 || isNaN(amount)) {
      App.showError('Enter a valid amount');
      return;
    }
    if (amount > 999999999) {
      App.showError('Amount too large');
      return;
    }
    if (!desc) {
      App.showError('Enter description');
      return;
    }
    if (desc.length > 200) {
      App.showError('Description too long');
      return;
    }
    if (Accounts.isSharedMode() && !payerId) {
      App.showError('Select who paid');
      return;
    }

    // Get custom split percentages if applicable
    let splitDetails = null;
    if (splitType === 'custom') {
      const inputs = document.querySelectorAll('.split-percent');
      const total = Array.from(inputs).reduce((sum, inp) => sum + (parseInt(inp.value) || 0), 0);
      if (total !== 100) {
        App.showError('Split must total 100%');
        return;
      }
      splitDetails = {};
      inputs.forEach(inp => {
        splitDetails[inp.dataset.id] = parseInt(inp.value) || 0;
      });
    }

    // Show loading on save button
    const saveBtn = document.getElementById('save-expense-btn');
    App.setButtonLoading(saveBtn, true);

    try {
      // Check for duplicate (same amount + similar description within 5 minutes)
      const duplicate = await this.checkForDuplicate(desc, amount, date);
      if (duplicate) {
        App.setButtonLoading(saveBtn, false);
        const confirmed = await this.showDuplicateWarning(duplicate);
        if (!confirmed) return;
        App.setButtonLoading(saveBtn, true);
      }

      const savedExpense = await DB.addExpense({
        description: desc,
        amount: amount,
        date: date,
        payerId: payerId,
        imageId: imageId,
        splitType: splitType,
        splitDetails: splitDetails,
        recurring: recurring,
        tags: tags,
        notes: notes
      });

      // Track new expense for animation
      this.newExpenseId = savedExpense.id;

      // Remember last payer
      if (payerId) {
        People.setLastPayer(payerId);
      }

      // Reset
      document.getElementById('expense-form').reset();
      document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
      Camera.removeImage(false);  // Clear preview but keep image in database

      App.setButtonLoading(saveBtn, false);
      App.showSuccess('Saved!');
      App.haptic('success');
      App.navigateTo('home');
    } catch (e) {
      console.error('Failed to save:', e);
      App.setButtonLoading(saveBtn, false);
      App.showError('Failed to save');
    }
  },

  // Check for potential duplicate expense
  async checkForDuplicate(description, amount, date) {
    try {
      // Skip check if description is too short
      if (!description || description.length < 3) return null;
      
      const recentExpenses = await DB.getExpenses();
      if (!recentExpenses || recentExpenses.length === 0) return null;
      
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      // Find expenses with same amount on same date, created recently
      const duplicate = recentExpenses.find(exp => {
        if (!exp.description) return false;
        const sameAmount = Math.abs(parseFloat(exp.amount) - amount) < 0.01;
        const sameDate = exp.date === date;
        const recentlyCreated = (now - (exp.createdAt || 0)) < fiveMinutes;
        const descLower = description.toLowerCase();
        const expDescLower = exp.description.toLowerCase();
        const similarDesc = descLower.length >= 5 && expDescLower.length >= 5 && 
                           (expDescLower.includes(descLower.substring(0, 5)) ||
                            descLower.includes(expDescLower.substring(0, 5)));
        
        return sameAmount && sameDate && (recentlyCreated || similarDesc);
      });
      
      return duplicate || null;
    } catch (e) {
      console.error('Duplicate check error:', e);
      return null;
    }
  },

  // Show duplicate warning modal
  showDuplicateWarning(duplicate) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-box duplicate-warning">
          <div class="duplicate-icon">⚠️</div>
          <h3>Possible Duplicate</h3>
          <p>A similar expense was found:</p>
          <div class="duplicate-details">
            <div class="duplicate-row">
              <span>Description</span>
              <strong>${duplicate.description}</strong>
            </div>
            <div class="duplicate-row">
              <span>Amount</span>
              <strong>${Settings.formatAmount(duplicate.amount)}</strong>
            </div>
            <div class="duplicate-row">
              <span>Date</span>
              <strong>${this.formatDate(duplicate.date)}</strong>
            </div>
          </div>
          <p class="duplicate-question">Add this expense anyway?</p>
          <div class="duplicate-buttons">
            <button class="btn-secondary" id="dup-cancel">Cancel</button>
            <button class="btn-primary" id="dup-confirm">Add Anyway</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      modal.querySelector('#dup-cancel').onclick = () => {
        modal.remove();
        resolve(false);
      };
      
      modal.querySelector('#dup-confirm').onclick = () => {
        modal.remove();
        resolve(true);
      };
      
      modal.onclick = (e) => {
        if (e.target === modal) {
          modal.remove();
          resolve(false);
        }
      };
    });
  },

  lastDeletedExpense: null,
  undoTimeout: null,

  async deleteExpense(id) {
    try {
      // Store expense for potential undo (before deletion)
      const exp = await DB.getExpenseById(id);
      if (!exp) return;
      
      // Store for undo
      this.lastDeletedExpense = { ...exp };
      
      // Clear any existing undo timeout
      if (this.undoTimeout) {
        clearTimeout(this.undoTimeout);
      }
      
      // Delete from DB
      await DB.deleteExpense(id);
      
      // Haptic feedback
      this.hapticFeedback('light');
      
      // Show undo toast
      this.showUndoToast();
      
      this.loadCurrentMonth();
    } catch (e) {
      console.error('Failed to delete:', e);
      App.showError('Failed to delete');
    }
  },

  showUndoToast() {
    // Remove existing undo toast if any
    document.querySelector('.undo-toast')?.remove();
    
    const toast = document.createElement('div');
    toast.className = 'undo-toast';
    toast.innerHTML = `
      <span>Expense deleted</span>
      <button class="undo-btn" onclick="Expenses.undoDelete()">Undo</button>
    `;
    document.body.appendChild(toast);
    
    // Auto-remove after 5 seconds
    this.undoTimeout = setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
      this.lastDeletedExpense = null;
    }, 5000);
  },

  async undoDelete() {
    if (!this.lastDeletedExpense) return;
    
    try {
      // Clear timeout
      if (this.undoTimeout) {
        clearTimeout(this.undoTimeout);
      }
      
      // Restore the expense
      await DB.addExpenseRaw(this.lastDeletedExpense);
      
      // Remove toast
      document.querySelector('.undo-toast')?.remove();
      
      App.showSuccess('Restored');
      this.lastDeletedExpense = null;
      this.loadCurrentMonth();
    } catch (e) {
      console.error('Failed to undo:', e);
      App.showError('Failed to restore');
    }
  },

  // Export expenses to CSV
  async exportToCSV() {
    try {
      const expenses = await DB.getExpenses();
      const people = await DB.getPeople();
      const names = {};
      people.forEach(p => names[p.id] = p.name);

      if (expenses.length === 0) {
        App.showError('No expenses to export');
        return;
      }

      const headers = ['Date', 'Description', 'Amount', 'Paid By'];
      const rows = expenses.map(e => [
        e.date,
        `"${e.description.replace(/"/g, '""')}"`,
        e.amount.toFixed(2),
        names[e.payerId] || 'Unknown'
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      App.showSuccess('Exported!');
    } catch (e) {
      console.error('Export failed:', e);
      App.showError('Export failed');
    }
  },

  // Search expenses - searches description, amount, and person name
  async searchExpenses(query) {
    if (!query) {
      document.querySelector('.month-nav')?.classList.remove('hidden');
      document.querySelector('.filter-row')?.classList.remove('hidden');
      this.loadCurrentMonth();
      return;
    }
    
    try {
      const allExpenses = await DB.getAllExpenses();
      const people = await DB.getPeople();
      const peopleMap = {};
      people.forEach(p => peopleMap[p.id] = p.name.toLowerCase());
      
      const q = query.toLowerCase();
      
      const filtered = allExpenses.filter(exp => {
        // Search in description
        if (exp.description.toLowerCase().includes(q)) return true;
        
        // Search in amount (e.g., "50" matches $50.00)
        if (exp.amount.toString().includes(q)) return true;
        
        // Search in formatted amount (e.g., "$50" or "50.00")
        if (Settings.formatAmount(exp.amount).toLowerCase().includes(q)) return true;
        
        // Search in payer name
        const payerName = peopleMap[exp.payerId] || '';
        if (payerName.includes(q)) return true;
        
        // Search in date (e.g., "jan" or "2024")
        if (exp.date.includes(q)) return true;
        const dateObj = new Date(exp.date);
        const monthName = dateObj.toLocaleDateString('en-US', { month: 'long' }).toLowerCase();
        if (monthName.includes(q)) return true;
        
        return false;
      });
      
      // Hide month nav and filters during search
      const monthNav = document.querySelector('.month-nav');
      const filterRow = document.querySelector('.filter-row');
      if (monthNav) monthNav.classList.add('hidden');
      if (filterRow) filterRow.classList.add('hidden');
      
      this.renderExpenses(filtered);
      
      // Update summary for search results
      const total = filtered.reduce((sum, e) => sum + e.amount, 0);
      const totalEl = document.getElementById('total-amount');
      const countEl = document.getElementById('expense-count');
      if (totalEl) totalEl.textContent = Settings.formatAmount(total);
      if (countEl) countEl.textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`;
    } catch (e) {
      console.error('Search failed:', e);
    }
  },

  currentCategoryFilter: 'all',

  async filterByCategory(category) {
    this.currentCategoryFilter = category;
    
    try {
      const expenses = await DB.getExpenses(this.currentMonth, this.currentYear);
      
      let filtered = expenses;
      if (category !== 'all') {
        filtered = expenses.filter(exp => {
          const icon = this.getCategoryIcon(exp.description);
          return icon === category;
        });
      }
      
      this.renderExpenses(filtered);
      
      // Update summary
      const total = filtered.reduce((sum, e) => sum + parseFloat(e.amount), 0);
      const totalEl = document.getElementById('total-amount');
      const countEl = document.getElementById('expense-count');
      if (totalEl) totalEl.textContent = Settings.formatAmount(total);
      if (countEl) countEl.textContent = `${filtered.length} expense${filtered.length !== 1 ? 's' : ''}`;
    } catch (e) {
      console.error('Filter failed:', e);
    }
  }
};
