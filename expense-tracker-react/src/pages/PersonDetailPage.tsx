import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useExpenseStore } from '@/stores/expenseStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { usePaymentStore } from '@/stores/paymentStore';
import { useAccountStore } from '@/stores/accountStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import { Button, useToast } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { computeBalances } from '@/lib/settlements';
import { formatDate } from '@/types';
import { cn } from '@/lib/utils';

export function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const allExpenses = useExpenseStore(s => s.allExpenses);
  const people = usePeopleStore(s => s.people);
  const { updatePerson, deletePerson, claimPerson } = usePeopleStore();
  const payments = usePaymentStore(s => s.payments);
  const isSharedMode = useAccountStore(s => s.isSharedMode());
  const selfPersonId = useAccountStore(s => s.selfPersonId);
  const setSelfPersonId = useAccountStore(s => s.setSelfPersonId);
  const deviceId = useSyncStore(s => s.deviceId);
  const formatAmount = useSettingsStore(s => s.formatAmount);

  const person = id ? people.find(p => p.id === id) : null;

  const totalPaid = allExpenses
    .filter(e => e.payerId === id)
    .reduce((sum, e) => sum + e.amount, 0);

  const balances = computeBalances(allExpenses, people, payments);
  const balanceObj = balances.find(b => b.personId === id);
  const balance = balanceObj?.amount ?? 0;

  const expensesPaid = allExpenses
    .filter(e => e.payerId === id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 15);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  const handleSetAsMe = async () => {
    if (!person || !deviceId) {
      showError('Sync not ready');
      return;
    }
    try {
      await claimPerson(person.id, deviceId);
      setSelfPersonId(person.id);
      showSuccess(`${person.name} is now you`);
    } catch {
      showError('Failed to set');
    }
  };

  const handleSaveName = async () => {
    if (!person || !editName.trim()) return;
    try {
      await updatePerson(person.id, editName.trim());
      showSuccess('Name updated');
      setEditingName(false);
    } catch {
      showError('Failed to update');
    }
  };

  const handleDelete = async () => {
    if (!person) return;
    try {
      await deletePerson(person.id);
      showSuccess('Deleted');
      setShowDeleteConfirm(false);
      navigate('/people');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  if (!id) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--bg)]">
        <header className="safe-top px-4 py-3 flex items-center border-b border-[var(--border)] bg-[var(--bg)]">
          <button onClick={() => navigate('/people')} className="text-[var(--teal-green)] font-medium">
            ‹ Back
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-[var(--text-secondary)]">Invalid person</p>
        </div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--bg)]">
        <header className="safe-top px-4 py-3 flex items-center border-b border-[var(--border)] bg-[var(--bg)]">
          <button onClick={() => navigate('/people')} className="text-[var(--teal-green)] font-medium">
            ‹ Back
          </button>
          <span className="flex-1 text-center font-semibold">Person</span>
          <div className="w-14" />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-[var(--text-secondary)] mb-4">This person could not be found.</p>
          <Button onClick={() => navigate('/people')}>Back to People</Button>
        </div>
      </div>
    );
  }

  const isSelf = selfPersonId === person.id;

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <header className="flex-shrink-0 safe-top px-4 py-3 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg)]">
        <button
          onClick={() => navigate('/people')}
          className="text-[var(--teal-green)] text-[17px] font-medium px-2 py-1 -mx-2 rounded-lg active:bg-[var(--teal-green)]/10"
        >
          ‹ Back
        </button>
        <span className="text-[17px] font-semibold">Person</span>
        <div className="w-14" aria-hidden />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[calc(80px+env(safe-area-inset-bottom))]">
        {/* Hero */}
        <div className="bg-[var(--white)] px-4 py-6 flex flex-col items-center text-center border-b border-[var(--border)]">
          <div className="w-20 h-20 rounded-full bg-[var(--teal-green)] text-white flex items-center justify-center text-3xl font-bold mb-3">
            {person.name.charAt(0).toUpperCase()}
          </div>
          {!editingName ? (
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <h1 className="text-xl font-bold">{person.name}</h1>
              {isSharedMode && isSelf && (
                <span className={cn(
                  'text-[12px] font-medium text-[var(--teal-green)] bg-[var(--teal-green)]/15 px-2.5 py-1 rounded-full'
                )}>
                  You
                </span>
              )}
              <button
                type="button"
                onClick={() => { setEditName(person.name); setEditingName(true); }}
                className="text-[var(--text-secondary)] text-sm px-2 py-1 rounded active:bg-[var(--bg)]"
                aria-label="Edit name"
              >
                Edit name
              </button>
            </div>
          ) : (
            <div className="w-full max-w-[200px] flex gap-2 mt-2">
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[16px]"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
              />
              <Button size="sm" onClick={handleSaveName}>Save</Button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="text-[var(--text-secondary)] text-sm"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="px-4 py-4 grid grid-cols-2 gap-3">
          <div className="bg-[var(--white)] rounded-xl p-4">
            <div className="text-[12px] text-[var(--text-secondary)] uppercase tracking-wide mb-1">Total paid</div>
            <div className="text-xl font-bold">{formatAmount(totalPaid)}</div>
          </div>
          <div className="bg-[var(--white)] rounded-xl p-4">
            <div className="text-[12px] text-[var(--text-secondary)] uppercase tracking-wide mb-1">Balance</div>
            <div className={cn(
              'text-xl font-bold',
              balance > 0.01 && 'text-[var(--teal-green)]',
              balance < -0.01 && 'text-[var(--danger)]'
            )}>
              {balance > 0.01 ? `Gets back ${formatAmount(balance)}` : balance < -0.01 ? `Owes ${formatAmount(-balance)}` : 'Settled'}
            </div>
          </div>
        </div>

        {/* Expenses they paid */}
        {expensesPaid.length > 0 && (
          <div className="px-4 mb-6">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2 px-1">
              Expenses they paid
            </h2>
            <div className="bg-[var(--white)] rounded-xl divide-y divide-[var(--border)]">
              {expensesPaid.map(exp => (
                <button
                  key={exp.id}
                  type="button"
                  onClick={() => navigate(`/expense/${exp.id}`)}
                  className="w-full flex items-center justify-between gap-3 p-4 text-left active:bg-[var(--bg)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{exp.description || 'No description'}</div>
                    <div className="text-[13px] text-[var(--text-secondary)]">{formatDate(exp.date)}</div>
                  </div>
                  <span className="font-semibold">{formatAmount(exp.amount)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="px-4 space-y-3">
          {isSharedMode && !isSelf && (
            <Button className="w-full" onClick={handleSetAsMe}>
              This is me
            </Button>
          )}
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-3 bg-[var(--danger)]/10 text-[var(--danger)] rounded-xl font-medium active:bg-[var(--danger)]/20"
          >
            Delete person
          </button>
        </div>
      </div>

      {/* Delete confirm */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete person"
      >
        <div className="p-6 text-center">
          <p className="text-[var(--text-secondary)] mb-6">
            Delete {person.name}? This cannot be undone. Expenses they paid will keep their name.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button className="flex-1 bg-[var(--danger)]" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
