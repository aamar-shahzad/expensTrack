import type { Person } from '@/types';
import { cn } from '@/lib/utils';

interface PersonItemProps {
  person: Person;
  onEdit: (person: Person) => void;
  onDelete: (id: string, name: string) => void;
  /** Tap row to open detail */
  onTap?: (person: Person) => void;
  /** In shared mode: show "This is me" or "You" */
  isSharedMode?: boolean;
  isSelf?: boolean;
  onSetAsMe?: (person: Person) => void;
  /** Only group creator can delete people; when false, hide delete */
  canDelete?: boolean;
}

export function PersonItem({ person, onEdit, onDelete, onTap, isSharedMode, isSelf, onSetAsMe, canDelete = true }: PersonItemProps) {
  return (
    <div className="flex items-center gap-3 p-4 bg-[var(--white)] rounded-xl">
      <button
        type="button"
        onClick={() => onTap?.(person)}
        className={cn(
          'flex items-center gap-3 flex-1 min-w-0 text-left',
          onTap && 'active:opacity-80'
        )}
      >
        <div className="w-12 h-12 rounded-full bg-[var(--teal-green)] text-white flex items-center justify-center text-lg font-bold shrink-0">
          {person.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-[16px] flex items-center gap-2">
            {person.name}
            {isSharedMode && isSelf && (
              <span className="text-[11px] font-medium text-[var(--teal-green)] bg-[var(--teal-green)]/15 px-2 py-0.5 rounded-full">
                You
              </span>
            )}
          </div>
        </div>
      </button>
      {isSharedMode && onSetAsMe && !isSelf && (
        <button
          type="button"
          onClick={() => onSetAsMe(person)}
          className="text-[13px] font-medium text-[var(--teal-green)] px-3 py-1.5 rounded-lg bg-[var(--teal-green)]/15 active:bg-[var(--teal-green)]/25"
        >
          This is me
        </button>
      )}
      <button
        type="button"
        onClick={() => onEdit(person)}
        className="p-2 text-[var(--text-secondary)] hover:text-[var(--text)]"
        aria-label="Edit"
      >
        ✏️
      </button>
      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(person.id, person.name)}
          className="p-2 text-[var(--danger)]"
          aria-label="Delete"
        >
          🗑️
        </button>
      )}
    </div>
  );
}
