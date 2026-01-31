import type { Person } from '@/types';
import { PersonItem } from './PersonItem';

interface PeopleListProps {
  people: Person[];
  onEdit: (person: Person) => void;
  onDelete: (id: string, name: string) => void;
  onTap?: (person: Person) => void;
  isSharedMode?: boolean;
  selfPersonId?: string | null;
  onSetAsMe?: (person: Person) => void;
  canManagePeople?: boolean;
}

export function PeopleList({ people, onEdit, onDelete, onTap, isSharedMode, selfPersonId, onSetAsMe, canManagePeople }: PeopleListProps) {
  if (people.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">👥</div>
        <h3 className="text-lg font-semibold mb-2">No people yet</h3>
        <p className="text-[var(--text-secondary)] mb-6">
          Add people to split expenses with. Tap + Add above to add your first person.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {people.map(person => (
        <PersonItem
          key={person.id}
          person={person}
          onEdit={onEdit}
          onDelete={onDelete}
          onTap={onTap}
          isSharedMode={isSharedMode}
          isSelf={selfPersonId === person.id}
          onSetAsMe={onSetAsMe}
          canDelete={canManagePeople !== false}
        />
      ))}
    </div>
  );
}
