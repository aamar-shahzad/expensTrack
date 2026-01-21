/**
 * People Management Module
 */

const People = {
  async init() {
    await this.ensureDefaultPerson();
  },

  async ensureDefaultPerson() {
    try {
      const people = await DB.getPeople();
      if (people.length === 0) {
        await DB.addPerson({ name: 'Me', isDefault: true });
      }
    } catch (e) {
      console.error('Failed to create default person:', e);
    }
  },

  async loadForDropdown() {
    try {
      const people = await DB.getPeople();
      const select = document.getElementById('expense-payer');
      if (!select) return;

      select.innerHTML = '<option value="">Select person...</option>' +
        people.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
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
        list.innerHTML = '<div class="empty-msg">No people added</div>';
        return;
      }

      list.innerHTML = people.map(p => `
        <div class="list-item">
          <div class="avatar">${p.name.charAt(0).toUpperCase()}</div>
          <div class="item-name">${p.name}</div>
          ${p.isDefault ? '<span class="tag">Default</span>' : 
            `<button class="btn-danger btn-small" onclick="People.deletePerson('${p.id}')">Delete</button>`}
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
      await DB.addPerson({ name, isDefault: false });
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
