/**
 * Expense Management Module
 */

const Expenses = {
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),

  async init() {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('expense-date')?.setAttribute('value', today);
  },

  async loadCurrentMonth() {
    try {
      const expenses = await DB.getExpenses(this.currentMonth, this.currentYear);
      await this.renderExpenses(expenses);
      this.updateMonthDisplay();
      this.updateSummary(expenses);
    } catch (error) {
      console.error('Failed to load expenses:', error);
      App.showError('Failed to load expenses');
    }
  },

  async renderExpenses(expenses) {
    const listElement = document.getElementById('expenses-list');
    if (!listElement) return;

    if (expenses.length === 0) {
      listElement.innerHTML = `
        <div class="card text-center">
          <p>No expenses for this month. Add your first expense!</p>
        </div>
      `;
      return;
    }

    // Load people data for names
    const people = await DB.getPeople();
    const peopleMap = {};
    people.forEach(person => {
      peopleMap[person.id] = person.name;
    });

    listElement.innerHTML = expenses.map(expense => `
      <div class="card expense-item">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h3 class="mb-1">${expense.description}</h3>
            <p class="text-sm text-gray-600">${new Date(expense.date).toLocaleDateString()}</p>
            <p class="text-sm">Paid by: ${peopleMap[expense.payerId] || 'Unknown'}</p>
          </div>
          <div class="text-right">
            <p class="text-lg font-bold">$${expense.amount.toFixed(2)}</p>
            <button class="btn btn-danger btn-sm" onclick="Expenses.deleteExpense('${expense.id}')">Delete</button>
          </div>
        </div>
        ${expense.imageId ? `
          <div class="mt-2">
            <img src="" alt="Receipt" class="receipt-thumb" onclick="Expenses.showFullImage('${expense.imageId}')" data-image-id="${expense.imageId}">
          </div>
        ` : ''}
      </div>
    `).join('');

    // Load image thumbnails
    await this.loadExpenseThumbnails(expenses);
  },

  updateMonthDisplay() {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const monthElement = document.getElementById('current-month');
    if (monthElement) {
      monthElement.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;
    }
  },

  updateSummary(expenses) {
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalElement = document.querySelector('.total-amount');
    if (totalElement) {
      totalElement.textContent = `$${total.toFixed(2)}`;
    }
  },

  navigateMonth(direction) {
    this.currentMonth += direction;

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
    const form = document.getElementById('expense-form');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const description = document.getElementById('expense-description').value.trim();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const date = document.getElementById('expense-date').value;
    const payerId = document.getElementById('expense-payer').value;
    const imageId = Camera.getCapturedImage()?.id;

    if (!description || amount <= 0 || !payerId) {
      App.showError('Please fill in all required fields');
      return;
    }

    try {
      const expenseData = {
        description,
        amount,
        date,
        payerId,
        imageId
      };

      const savedExpense = await DB.addExpense(expenseData);

      // Broadcast to connected devices
      if (Sync.getConnectionCount() > 0) {
        await Sync.broadcastChange('expense_add', savedExpense);
      }

      // Reset form and camera
      form.reset();
      Camera.removeImage();
      // Reset date to today
      document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];

      App.showSuccess('Expense saved successfully');
      App.navigateTo('home');

    } catch (error) {
      console.error('Failed to save expense:', error);
      App.showError('Failed to save expense');
    }
  },

  async deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      // Get expense to check for image
      const expense = await DB.getExpenseById(id);
      await DB.deleteExpense(id);

      // Delete associated image if exists
      if (expense?.imageId) {
        await DB.deleteImage(expense.imageId);
      }

      // Broadcast deletion to connected devices
      if (Sync.getConnectionCount() > 0) {
        await Sync.broadcastChange('expense_delete', { id });
      }

      App.showSuccess('Expense deleted successfully');
      this.loadCurrentMonth();

    } catch (error) {
      console.error('Failed to delete expense:', error);
      App.showError('Failed to delete expense');
    }
  },

  async loadExpenseThumbnails(expenses) {
    const imagesToLoad = expenses.filter(expense => expense.imageId);

    for (const expense of imagesToLoad) {
      try {
        const imageData = await DB.getImage(expense.imageId);
        if (imageData && imageData.thumbnail) {
          const imgElement = document.querySelector(`[data-image-id="${expense.imageId}"]`);
          if (imgElement) {
            const blobUrl = URL.createObjectURL(imageData.thumbnail);
            imgElement.src = blobUrl;
          }
        }
      } catch (error) {
        console.error('Failed to load thumbnail:', error);
      }
    }
  },

  async showFullImage(imageId) {
    try {
      const imageData = await DB.getImage(imageId);
      if (!imageData) return;

      const blobUrl = URL.createObjectURL(imageData.blob);

      // Create full image modal
      const modal = document.createElement('div');
      modal.className = 'modal-container';
      modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Receipt</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body text-center">
            <img src="${blobUrl}" alt="Receipt" style="max-width: 100%; max-height: 70vh; border-radius: 0.5rem;">
          </div>
        </div>
      `;

      document.getElementById('modals').appendChild(modal);

      modal.querySelector('.modal-close').addEventListener('click', () => {
        URL.revokeObjectURL(blobUrl); // Clean up blob URL
        modal.remove();
      });
      modal.querySelector('.modal-backdrop').addEventListener('click', () => {
        URL.revokeObjectURL(blobUrl); // Clean up blob URL
        modal.remove();
      });

    } catch (error) {
      console.error('Failed to show full image:', error);
      App.showError('Failed to load image');
    }
  }
};
