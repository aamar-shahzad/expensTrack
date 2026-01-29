import type { Person } from '@/types';

interface PersonItemProps {
  person: Person;
  onEdit: (person: Person) => void;
  onDelete: (id: string, name: string) => void;
}

export function PersonItem({ person, onEdit, onDelete }: PersonItemProps) {
  return (
    <div className="flex items-center gap-3 p-4 bg-[var(--white)] rounded-xl">
      <div className="w-12 h-12 rounded-full bg-[var(--teal-green)] text-white flex items-center justify-center text-lg font-bold">
        {person.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1">
        <div className="font-medium text-[16px]">{person.name}</div>
      </div>
      <button
        onClick={() => onEdit(person)}
        className="p-2 text-[var(--text-secondary)] hover:text-[var(--text)]"
      >
        ✏️
      </button>
      <button
        onClick={() => onDelete(person.id, person.name)}
        className="p-2 text-[var(--danger)]"
      >
        🗑️
      </button>
    </div>
  );
}
