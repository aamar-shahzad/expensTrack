import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePeopleStore } from '@/stores/peopleStore';
import { useAccountStore } from '@/stores/accountStore';
import { useSyncStore } from '@/stores/syncStore';
import { Button, Input, Sheet, useToast } from '@/components/ui';
import { PeopleList } from '@/components/people';
import { haptic } from '@/lib/utils';
import type { Person } from '@/types';

export function PeoplePage() {
  const navigate = useNavigate();
  const { people, loadPeople, addPerson, updatePerson, deletePerson, claimPerson } = usePeopleStore();
  const isSharedMode = useAccountStore(s => s.isSharedMode());
  const selfPersonId = useAccountStore(s => s.selfPersonId);
  const setSelfPersonId = useAccountStore(s => s.setSelfPersonId);
  const deviceId = useSyncStore(s => s.deviceId);
  const { showSuccess, showError } = useToast();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  const handleAdd = async () => {
    if (!newName.trim()) {
      showError('Enter a name');
      return;
    }
    
    setSaving(true);
    try {
      await addPerson(newName.trim());
      haptic('success');
      showSuccess('Person added');
      setNewName('');
      setShowAddModal(false);
    } catch {
      showError('Failed to add');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingPerson || !newName.trim()) {
      showError('Enter a name');
      return;
    }
    
    setSaving(true);
    try {
      await updatePerson(editingPerson.id, newName.trim());
      haptic('success');
      showSuccess('Updated');
      setNewName('');
      setEditingPerson(null);
    } catch {
      showError('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    
    try {
      await deletePerson(id);
      haptic('success');
      showSuccess('Deleted');
    } catch (error) {
      // Show the specific error message if available
      const message = error instanceof Error ? error.message : 'Failed to delete';
      showError(message);
    }
  };

  const openEdit = (person: Person) => {
    setEditingPerson(person);
    setNewName(person.name);
  };

  const handleSetAsMe = async (person: Person) => {
    if (!deviceId) {
      showError('Sync not ready');
      return;
    }
    try {
      await claimPerson(person.id, deviceId);
      setSelfPersonId(person.id);
      haptic('success');
      showSuccess(`${person.name} is now you`);
    } catch {
      showError('Failed to set');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 safe-top">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">People</h1>
          <Button
            size="sm"
            onClick={() => { setNewName(''); setShowAddModal(true); }}
          >
            + Add
          </Button>
        </div>
        <p className="text-[var(--text-secondary)] text-sm">
          Manage people in your shared expense group
        </p>
      </div>

      {/* People List */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-[calc(90px+env(safe-area-inset-bottom))]">
        <PeopleList
          people={people}
          onEdit={openEdit}
          onDelete={handleDelete}
          onTap={(person) => navigate(`/people/${person.id}`)}
          isSharedMode={isSharedMode}
          selfPersonId={selfPersonId}
          onSetAsMe={isSharedMode ? handleSetAsMe : undefined}
        />
      </div>

      {/* Add Modal */}
      <Sheet
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Person"
        actions={
          <button
            onClick={handleAdd}
            disabled={saving}
            className="text-[var(--teal-green)] text-[17px] font-semibold px-2 py-1 -mx-2 rounded-lg active:bg-[var(--teal-green)]/10 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        }
      >
        <div className="p-4">
          <Input
            label="Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. Alex, Roommate"
            autoFocus
          />
          <p className="text-[13px] text-[var(--text-secondary)] mt-3">
            Names are used when splitting expenses and on the Settle tab.
          </p>
        </div>
      </Sheet>

      {/* Edit Modal */}
      <Sheet
        isOpen={!!editingPerson}
        onClose={() => setEditingPerson(null)}
        title="Edit Person"
        actions={
          <button
            onClick={handleUpdate}
            disabled={saving}
            className="text-[var(--teal-green)] text-[17px] font-semibold px-2 py-1 -mx-2 rounded-lg active:bg-[var(--teal-green)]/10 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        }
      >
        <div className="p-4">
          <Input
            label="Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Enter name"
            autoFocus
          />
        </div>
      </Sheet>
    </div>
  );
}
