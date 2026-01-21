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
      const list = document.getElementById('people-list');
      if (!list) return;

      if (people.length === 0) {
        list.innerHTML = '<div class="empty-msg">No people added yet.<br>Add people who share expenses.</div>';
        return;
      }

      list.innerHTML = people.map(p => `
        <div class="list-item">
          <div class="avatar">${p.name.charAt(0).toUpperCase()}</div>
          <div class="item-name">${p.name}</div>
          <button class="btn-danger btn-small" onclick="People.deletePerson('${p.id}')">Delete</button>
        </div>
      `).join('');
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

  async deletePerson(id) {
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
