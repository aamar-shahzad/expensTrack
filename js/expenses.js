/**
 * Expense Management Module
 */

const Expenses = {
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),

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
          <div class="empty-title">No expenses this month</div>
          <div class="empty-text">Tap the Add button below to add your first expense</div>
        </div>
      `;
      return;
    }

    // Get people names
    const people = await DB.getPeople();
    const names = {};
    people.forEach(p => names[p.id] = p.name);

    list.innerHTML = expenses.map(exp => `
      <div class="expense-item" onclick="Expenses.showDetail('${exp.id}')">
        ${exp.imageId ? `<div class="expense-thumb" data-img="${exp.imageId}"></div>` : '<div class="expense-icon">💵</div>'}
        <div class="expense-main">
          <div class="expense-desc">${exp.description}</div>
          <div class="expense-meta">${names[exp.payerId] || 'Unknown'} • ${this.formatDate(exp.date)}</div>
        </div>
        <div class="expense-amount">$${parseFloat(exp.amount).toFixed(2)}</div>
      </div>
    `).join('');

    // Load thumbnails
    this.loadThumbnails();
  },

  async loadThumbnails() {
    const thumbs = document.querySelectorAll('.expense-thumb[data-img]');
    for (const thumb of thumbs) {
      const imgId = thumb.dataset.img;
      try {
        const img = await DB.getImage(imgId);
        if (img && img.thumbnail) {
          const url = URL.createObjectURL(img.thumbnail);
          thumb.style.backgroundImage = `url(${url})`;
        }
      } catch (e) {}
    }
  },

  async showDetail(id) {
    const exp = await DB.getExpenseById(id);
    if (!exp) return;

    const people = await DB.getPeople();
    const payer = people.find(p => p.id === exp.payerId);

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
            <span class="detail-value">${exp.description}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Amount</span>
            <span class="detail-value detail-amount">$${parseFloat(exp.amount).toFixed(2)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date</span>
            <span class="detail-value">${new Date(exp.date).toLocaleDateString()}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Paid By</span>
            <span class="detail-value">${payer?.name || 'Unknown'}</span>
          </div>
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

    const people = await DB.getPeople();
    const peopleOptions = people.map(p => 
      `<option value="${p.id}" ${p.id === exp.payerId ? 'selected' : ''}>${p.name}</option>`
    ).join('');

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
          <div class="input-group">
            <label>Paid By</label>
            <select id="edit-payer">${peopleOptions}</select>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('update-expense-btn').onclick = async () => {
      const desc = document.getElementById('edit-description').value.trim();
      const amount = parseFloat(document.getElementById('edit-amount').value);
      const date = document.getElementById('edit-date').value;
      const payerId = document.getElementById('edit-payer').value;

      if (!desc || !amount || !date || !payerId) {
        App.showError('Fill all fields');
        return;
      }

      try {
        await DB.updateExpense(id, { description: desc, amount, date, payerId });
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
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
    
    const countEl = document.getElementById('expense-count');
    if (countEl) countEl.textContent = `${expenses.length} expense${expenses.length !== 1 ? 's' : ''}`;
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

  async saveExpense() {
    const desc = document.getElementById('expense-description').value.trim();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const date = document.getElementById('expense-date').value;
    const payerId = document.getElementById('expense-payer').value;
    const imageId = Camera.capturedImage?.id || null;

    if (!desc) {
      App.showError('Enter description');
      return;
    }
    if (!amount || amount <= 0) {
      App.showError('Enter valid amount');
      return;
    }
    if (!payerId) {
      App.showError('Select who paid');
      return;
    }

    try {
      await DB.addExpense({
        description: desc,
        amount: amount,
        date: date,
        payerId: payerId,
        imageId: imageId
      });

      // Reset
      document.getElementById('expense-form').reset();
      document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
      Camera.removeImage();

      App.showSuccess('Saved!');
      App.navigateTo('home');
    } catch (e) {
      console.error('Failed to save:', e);
      App.showError('Failed to save');
    }
  },

  async deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;

    try {
      const exp = await DB.getExpenseById(id);
      await DB.deleteExpense(id);
      
      if (exp?.imageId) {
        await DB.deleteImage(exp.imageId);
      }

      App.showSuccess('Deleted');
      this.loadCurrentMonth();
    } catch (e) {
      console.error('Failed to delete:', e);
      App.showError('Failed to delete');
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
  }
};
