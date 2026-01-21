/**
 * People Management Module
 */

const People = {
  async init() {
    // Ensure default "Me" person exists
    await this.ensureDefaultPerson();
  },

  async ensureDefaultPerson() {
    try {
      const people = await DB.getPeople();
      const hasDefault = people.some(person => person.isDefault);

      if (!hasDefault) {
        await DB.addPerson({
          name: 'Me',
          isDefault: true
        });
      }
    } catch (error) {
      console.error('Failed to ensure default person:', error);
    }
  },

  async loadForDropdown() {
    try {
      const people = await DB.getPeople();
      const select = document.getElementById('expense-payer');
      if (!select) return;

      select.innerHTML = '<option value="">Select person...</option>' +
        people.map(person => `<option value="${person.id}">${person.name}</option>`).join('');

    } catch (error) {
      console.error('Failed to load people for dropdown:', error);
    }
  },

  async loadPeopleList() {
    try {
      const people = await DB.getPeople();
      const listElement = document.getElementById('people-list');
      if (!listElement) return;

      if (people.length === 0) {
        listElement.innerHTML = '<div class="card text-center"><p>No people added yet.</p></div>';
        return;
      }

      listElement.innerHTML = people.map(person => `
        <div class="card person-item">
          <div class="flex justify-between items-center">
            <div>
              <h3>${person.name}</h3>
              ${person.isDefault ? '<span class="badge">Default</span>' : ''}
            </div>
            <div class="flex gap-2">
              <button class="btn btn-danger btn-sm" onclick="People.deletePerson('${person.id}')" ${person.isDefault ? 'disabled' : ''}>
                Delete
              </button>
            </div>
          </div>
        </div>
      `).join('');

    } catch (error) {
      console.error('Failed to load people list:', error);
      App.showError('Failed to load people');
    }
  },

  async savePerson() {
    const name = document.getElementById('person-name')?.value?.trim();
    if (!name) {
      App.showError('Please enter a name');
      return;
    }

    try {
      const personData = await DB.addPerson({ name, isDefault: false });

      // Broadcast to connected devices
      if (Sync.getConnectionCount() > 0) {
        await Sync.broadcastChange('person_add', personData);
      }

      App.showSuccess('Person added successfully');
      this.loadPeopleList();
      this.loadForDropdown(); // Update dropdowns

    } catch (error) {
      console.error('Failed to save person:', error);
      App.showError('Failed to add person');
    }
  },

  async deletePerson(id) {
    if (!confirm('Are you sure you want to delete this person?')) return;

    try {
      await DB.deletePerson(id);
      App.showSuccess('Person deleted successfully');
      this.loadPeopleList();
      this.loadForDropdown(); // Update dropdowns

    } catch (error) {
      console.error('Failed to delete person:', error);
      App.showError('Failed to delete person');
    }
  },

  async getPersonName(id) {
    try {
      const people = await DB.getPeople();
      const person = people.find(p => p.id === id);
      return person ? person.name : 'Unknown';
    } catch (error) {
      console.error('Failed to get person name:', error);
      return 'Unknown';
    }
  }
};
