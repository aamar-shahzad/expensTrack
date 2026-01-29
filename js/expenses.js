/**
 * Expense Management Module
 */

const Expenses = {
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  thumbnailUrls: [], // Track object URLs for cleanup

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
    try {
      const expenses = await DB.getExpenses(this.currentMonth, this.currentYear);
      this.renderExpenses(expenses);
      this.updateMonthDisplay();
      this.updateSummary(expenses);
    } catch (e) {
      console.error('Failed to load expenses:', e);
    }
  },

  async renderExpenses(expenses) {
    const list = document.getElementById('expenses-list');
    if (!list) return;

    if (expenses.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <div class="empty-title">No expenses yet</div>
          <div class="empty-text">Tap the + button to add your first expense</div>
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

    list.innerHTML = expenses.map(exp => {
      const payerName = Accounts.isSharedMode() ? `${names[exp.payerId] || 'Unknown'} • ` : '';
      const categoryIcon = this.getCategoryIcon(exp.description);
      return `
        <div class="expense-item" onclick="Expenses.showDetail('${exp.id}')">
          ${exp.imageId ? `<div class="expense-thumb" data-img="${exp.imageId}"></div>` : `<div class="expense-icon">${categoryIcon}</div>`}
          <div class="expense-main">
            <div class="expense-desc">${exp.description}</div>
            <div class="expense-meta">${payerName}${this.formatDate(exp.date)}</div>
          </div>
          <div class="expense-amount">${Settings.formatAmount(exp.amount)}</div>
        </div>
      `;
    }).join('');

    // Load thumbnails
    this.loadThumbnails();
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

    if (!amount || amount <= 0) {
      App.showError('Enter amount');
      return;
    }
    if (!desc) {
      App.showError('Enter description');
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

    try {
      await DB.addExpense({
        description: desc,
        amount: amount,
        date: date,
        payerId: payerId,
        imageId: imageId,
        splitType: splitType,
        splitDetails: splitDetails,
        recurring: recurring
      });

      // Remember last payer
      if (payerId) {
        People.setLastPayer(payerId);
      }

      // Reset
      document.getElementById('expense-form').reset();
      document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
      Camera.removeImage(false);  // Clear preview but keep image in database

      App.showSuccess('Saved!');
      App.navigateTo('home');
    } catch (e) {
      console.error('Failed to save:', e);
      App.showError('Failed to save');
    }
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
  }
};
