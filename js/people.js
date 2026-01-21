/**
 * People Management Module
 */

const People = {
  async init() {
    // No default person - user adds their own
  },

  async loadForDropdown() {
    try {
      const people = await DB.getPeople();
      const select = document.getElementById('expense-payer');
      if (!select) return;

      if (people.length === 0) {
        select.innerHTML = '<option value="">Add people first...</option>';
      } else {
        select.innerHTML = '<option value="">Select person...</option>' +
          people.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      }
    } catch (e) {
      console.error('Failed to load dropdown:', e);
    }
  },

  async loadPeopleList() {
    try {
      const people = await DB.getPeople();
      const expenses = await DB.getExpenses();
      const list = document.getElementById('people-list');
      if (!list) return;

      if (people.length === 0) {
        list.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">👥</div>
            <div class="empty-title">No people yet</div>
            <div class="empty-text">Add people who share expenses with you</div>
          </div>
        `;
        return;
      }

      // Count expenses per person
      const expenseCount = {};
      const expenseTotal = {};
      expenses.forEach(e => {
        expenseCount[e.payerId] = (expenseCount[e.payerId] || 0) + 1;
        expenseTotal[e.payerId] = (expenseTotal[e.payerId] || 0) + parseFloat(e.amount);
      });

      list.innerHTML = people.map(p => {
        const count = expenseCount[p.id] || 0;
        const total = expenseTotal[p.id] || 0;
        return `
          <div class="list-item">
            <div class="avatar">${p.name.charAt(0).toUpperCase()}</div>
            <div class="item-info">
              <div class="item-name">${p.name}</div>
              <div class="item-meta">${count} expense${count !== 1 ? 's' : ''} • ${Settings.formatAmount(total)} paid</div>
            </div>
            <button class="btn-icon" onclick="People.deletePerson('${p.id}', ${count})">🗑️</button>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.error('Failed to load people:', e);
    }
  },

  async savePerson(name) {
    if (!name) {
      App.showError('Enter a name');
      return;
    }

    try {
      await DB.addPerson({ name });
      App.showSuccess('Person added');
      this.loadPeopleList();
      this.loadForDropdown();
    } catch (e) {
      console.error('Failed to save person:', e);
      App.showError('Failed to add person');
    }
  },

  async deletePerson(id, expenseCount = 0) {
    if (expenseCount > 0) {
      App.showError(`Can't delete - has ${expenseCount} expense${expenseCount > 1 ? 's' : ''}`);
      return;
    }

    if (!confirm('Delete this person?')) return;

    try {
      await DB.deletePerson(id);
      App.showSuccess('Deleted');
      this.loadPeopleList();
      this.loadForDropdown();
    } catch (e) {
      console.error('Failed to delete:', e);
      App.showError('Failed to delete');
    }
  }
};
