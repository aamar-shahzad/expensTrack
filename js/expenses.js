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
      list.innerHTML = '<div class="empty-msg">No expenses this month</div>';
      return;
    }

    // Get people names
    const people = await DB.getPeople();
    const names = {};
    people.forEach(p => names[p.id] = p.name);

    list.innerHTML = expenses.map(exp => `
      <div class="expense-item">
        <div class="expense-main">
          <div class="expense-desc">${exp.description}</div>
          <div class="expense-meta">${names[exp.payerId] || 'Unknown'} • ${this.formatDate(exp.date)}</div>
        </div>
        <div class="expense-right">
          <div class="expense-amount">$${parseFloat(exp.amount).toFixed(2)}</div>
          <button class="btn-delete" onclick="Expenses.deleteExpense('${exp.id}')">×</button>
        </div>
        ${exp.imageId ? `<div class="expense-image" onclick="Expenses.showImage('${exp.imageId}')">📷</div>` : ''}
      </div>
    `).join('');
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

  async showImage(imageId) {
    try {
      const img = await DB.getImage(imageId);
      if (!img) return;

      const url = URL.createObjectURL(img.blob);
      
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-box">
          <div class="modal-header">
            <span>Receipt</span>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body">
            <img src="${url}" style="max-width:100%; max-height:70vh;">
          </div>
        </div>
      `;
      
      modal.onclick = (e) => {
        if (e.target === modal) {
          URL.revokeObjectURL(url);
          modal.remove();
        }
      };
      
      document.body.appendChild(modal);
    } catch (e) {
      console.error('Failed to show image:', e);
    }
  }
};
