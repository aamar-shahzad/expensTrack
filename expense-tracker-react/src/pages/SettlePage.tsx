import { useEffect, useMemo, useState } from 'react';
import { useExpenseStore } from '@/stores/expenseStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { usePaymentStore } from '@/stores/paymentStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Sheet, Input, Button, useToast } from '@/components/ui';
import { haptic, cn } from '@/lib/utils';
import type { Settlement, Person } from '@/types';

export function SettlePage() {
  const { allExpenses, loadAllExpenses } = useExpenseStore();
  const { people, loadPeople, getPersonName } = usePeopleStore();
  const { payments, addPayment, deletePayment } = usePaymentStore();
  const formatAmount = useSettingsStore(s => s.formatAmount);
  const { showSuccess, showError } = useToast();
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAllExpenses();
    loadPeople();
  }, [loadAllExpenses, loadPeople]);

  // Helper to round to 2 decimal places for currency
  const roundCurrency = (amount: number) => Math.round(amount * 100) / 100;

  // Calculate balances and settlements
  const { totalExpenses, sharePerPerson, personSpent, balances, settlements } = useMemo(() => {
    if (people.length === 0 || allExpenses.length === 0) {
      return { totalExpenses: 0, sharePerPerson: 0, personSpent: {}, balances: {}, settlements: [] };
    }

    const personPaid: Record<string, number> = {};
    const personOwes: Record<string, number> = {};
    let total = 0;

    // Initialize all people with 0
    people.forEach(p => {
      personPaid[p.id] = 0;
      personOwes[p.id] = 0;
    });

    // Calculate what each person paid and owes based on split type
    allExpenses.forEach(expense => {
      const amount = expense.amount;
      total += amount;
      
      // Track what the payer paid
      if (expense.payerId && personPaid[expense.payerId] !== undefined) {
        personPaid[expense.payerId] += amount;
      }
      
      // Determine who this expense is split with
      let splitParticipants: string[];
      
      if (expense.splitType === 'full' && expense.payerId) {
        // Full means only the payer owes (no split)
        splitParticipants = [expense.payerId];
      } else if (expense.splitWith && expense.splitWith.length > 0) {
        // Custom split participants
        splitParticipants = expense.splitWith;
      } else {
        // Default: equal split among all people
        splitParticipants = people.map(p => p.id);
      }

      // Filter to only include valid people
      splitParticipants = splitParticipants.filter(id => personOwes[id] !== undefined);

      if (splitParticipants.length === 0) {
        // Fallback to all people if no valid participants
        splitParticipants = people.map(p => p.id);
      }

      // Calculate shares based on split type
      if (expense.splitType === 'custom' && expense.splitDetails) {
        // Custom amounts per person
        for (const [personId, shareAmount] of Object.entries(expense.splitDetails)) {
          if (personOwes[personId] !== undefined) {
            personOwes[personId] += shareAmount;
          }
        }
      } else {
        // Equal split among participants
        const share = roundCurrency(amount / splitParticipants.length);
        splitParticipants.forEach(personId => {
          personOwes[personId] += share;
        });
      }
    });

    // Adjust for payments already made
    // When A pays B: A's debt decreases, B's credit decreases (B received money they were owed)
    payments.forEach(payment => {
      if (personPaid[payment.fromId] !== undefined) {
        personPaid[payment.fromId] += payment.amount; // fromId effectively "paid" more
      }
      if (personOwes[payment.toId] !== undefined) {
        personOwes[payment.toId] += payment.amount; // toId now "owes" more (cancels their credit)
      }
    });

    // Calculate balances (positive = owed money back, negative = owes money)
    const balanceMap: Record<string, number> = {};
    for (const person of people) {
      const paid = personPaid[person.id] || 0;
      const owes = personOwes[person.id] || 0;
      balanceMap[person.id] = roundCurrency(paid - owes);
    }

    // Calculate settlement transactions using greedy algorithm
    const EPSILON = 0.005; // Half a cent threshold
    const debtors: { person: Person; amount: number }[] = [];
    const creditors: { person: Person; amount: number }[] = [];

    for (const person of people) {
      const balance = balanceMap[person.id] || 0;
      if (balance < -EPSILON) {
        debtors.push({ person, amount: roundCurrency(-balance) });
      } else if (balance > EPSILON) {
        creditors.push({ person, amount: roundCurrency(balance) });
      }
    }

    // Sort by amount descending for optimal settlement
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const settlementList: Settlement[] = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const paymentAmount = roundCurrency(Math.min(debtor.amount, creditor.amount));

      if (paymentAmount > EPSILON) {
        settlementList.push({
          from: debtor.person,
          to: creditor.person,
          amount: paymentAmount
        });
      }

      debtor.amount = roundCurrency(debtor.amount - paymentAmount);
      creditor.amount = roundCurrency(creditor.amount - paymentAmount);

      if (debtor.amount <= EPSILON) i++;
      if (creditor.amount <= EPSILON) j++;
    }

    return {
      totalExpenses: roundCurrency(total),
      sharePerPerson: roundCurrency(total / people.length),
      personSpent: personPaid,
      balances: balanceMap,
      settlements: settlementList
    };
  }, [allExpenses, people, payments]);

  const handleRecordPayment = async () => {
    if (!selectedSettlement) return;
    
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      showError('Enter a valid amount');
      return;
    }

    setSaving(true);
    try {
      await addPayment({
        fromId: selectedSettlement.from.id,
        toId: selectedSettlement.to.id,
        amount,
        date: new Date().toISOString().split('T')[0]
      });
      
      haptic('success');
      showSuccess('Payment recorded');
      setShowPaymentModal(false);
      setSelectedSettlement(null);
      setPaymentAmount('');
    } catch {
      showError('Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm('Delete this payment record?')) return;
    
    try {
      await deletePayment(id);
      haptic('success');
      showSuccess('Payment deleted');
    } catch {
      showError('Failed to delete');
    }
  };

  const openPaymentModal = (settlement: Settlement) => {
    setSelectedSettlement(settlement);
    setPaymentAmount(settlement.amount.toFixed(2));
    setShowPaymentModal(true);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 safe-top">
        <h1 className="text-2xl font-bold mb-1">Settle Up</h1>
        <p className="text-[var(--text-secondary)] text-sm">
          See who owes who and record payments
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[calc(90px+env(safe-area-inset-bottom))]">
        {people.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">💰</div>
            <h3 className="text-lg font-semibold mb-2">Add people first</h3>
            <p className="text-[var(--text-secondary)]">
              Go to People tab to add members
            </p>
          </div>
        ) : allExpenses.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-lg font-semibold mb-2">No expenses yet</h3>
            <p className="text-[var(--text-secondary)]">
              Add some expenses to calculate settlements
            </p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="px-4 mb-6">
              <div className="bg-[var(--white)] rounded-xl p-4 flex">
                <div className="flex-1 text-center border-r border-[var(--border)]">
                  <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1">Total Spent</div>
                  <div className="text-2xl font-bold">{formatAmount(totalExpenses)}</div>
                </div>
                <div className="flex-1 text-center">
                  <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1">Per Person</div>
                  <div className="text-2xl font-bold">{formatAmount(sharePerPerson)}</div>
                </div>
              </div>
            </div>

            {/* Who Spent What */}
            <div className="px-4 mb-6">
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2 px-1">
                Who Spent What
              </h2>
              <div className="bg-[var(--white)] rounded-xl divide-y divide-[var(--border)]">
                {people.map(person => {
                  const spent = personSpent[person.id] || 0;
                  const balance = balances[person.id] || 0;
                  
                  return (
                    <div key={person.id} className="flex items-center gap-3 p-4">
                      <div className="w-10 h-10 rounded-full bg-[var(--teal-green)]/10 text-[var(--teal-green)] flex items-center justify-center font-bold">
                        {person.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{person.name}</div>
                        <div className="text-sm text-[var(--text-secondary)]">
                          Spent {formatAmount(spent)}
                        </div>
                      </div>
                      <div className={cn(
                        'text-sm font-medium text-right',
                        balance > 0.01 && 'text-[var(--teal-green)]',
                        balance < -0.01 && 'text-[var(--danger)]'
                      )}>
                        {balance > 0.01 ? (
                          <>gets back<br/>{formatAmount(balance)}</>
                        ) : balance < -0.01 ? (
                          <>owes<br/>{formatAmount(-balance)}</>
                        ) : (
                          'settled'
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Settlement Plan */}
            <div className="px-4 mb-6">
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2 px-1">
                Settlement Plan
              </h2>
              {settlements.length === 0 ? (
                <div className="bg-[var(--white)] rounded-xl p-6 text-center">
                  <div className="text-3xl mb-2">✅</div>
                  <div className="font-semibold text-[var(--teal-green)]">Everyone is settled up!</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {settlements.map((settlement, i) => (
                    <div key={i} className="bg-[var(--white)] rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--danger)]/10 text-[var(--danger)] flex items-center justify-center font-bold text-sm">
                          {settlement.from.name.charAt(0)}
                        </div>
                        <div className="text-[var(--text-secondary)] text-lg">→</div>
                        <div className="w-9 h-9 rounded-full bg-[var(--teal-green)]/10 text-[var(--teal-green)] flex items-center justify-center font-bold text-sm">
                          {settlement.to.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <span className="font-medium">{settlement.from.name}</span>
                          <span className="text-[var(--text-secondary)]"> pays </span>
                          <span className="font-medium">{settlement.to.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-2xl font-bold">{formatAmount(settlement.amount)}</div>
                        <Button
                          size="sm"
                          onClick={() => openPaymentModal(settlement)}
                        >
                          Mark Paid
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment History */}
            <div className="px-4 mb-6">
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2 px-1">
                Payment History
              </h2>
              {payments.length === 0 ? (
                <div className="bg-[var(--white)] rounded-xl p-4 text-center text-[var(--text-secondary)]">
                  No payments recorded yet
                </div>
              ) : (
                <div className="bg-[var(--white)] rounded-xl divide-y divide-[var(--border)]">
                  {payments.slice(0, 10).map(payment => (
                    <div key={payment.id} className="flex items-center gap-3 p-4">
                      <div className="flex-1">
                        <div className="font-medium">
                          {getPersonName(payment.fromId)} → {getPersonName(payment.toId)}
                        </div>
                        <div className="text-sm text-[var(--text-secondary)]">
                          {formatDate(payment.date)}
                        </div>
                      </div>
                      <div className="font-semibold">{formatAmount(payment.amount)}</div>
                      <button
                        onClick={() => handleDeletePayment(payment.id)}
                        className="w-8 h-8 rounded-full text-[var(--danger)] hover:bg-[var(--danger)]/10 flex items-center justify-center"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {payments.length > 10 && (
                    <div className="p-3 text-center text-sm text-[var(--text-secondary)]">
                      + {payments.length - 10} more payments
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Payment Modal */}
      <Sheet
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Record Payment"
        actions={
          <button
            onClick={handleRecordPayment}
            disabled={saving}
            className="text-[var(--teal-green)] text-[17px] font-semibold px-2 py-1 -mx-2 rounded-lg active:bg-[var(--teal-green)]/10 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        }
      >
        {selectedSettlement && (
          <div className="p-4">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-[var(--danger)]/10 text-[var(--danger)] flex items-center justify-center font-bold text-lg">
                {selectedSettlement.from.name.charAt(0)}
              </div>
              <div className="text-2xl text-[var(--text-secondary)]">→</div>
              <div className="w-12 h-12 rounded-full bg-[var(--teal-green)]/10 text-[var(--teal-green)] flex items-center justify-center font-bold text-lg">
                {selectedSettlement.to.name.charAt(0)}
              </div>
            </div>
            <div className="text-center mb-4">
              <span className="font-semibold">{selectedSettlement.from.name}</span>
              <span className="text-[var(--text-secondary)]"> pays </span>
              <span className="font-semibold">{selectedSettlement.to.name}</span>
            </div>
            <Input
              label="Amount"
              type="number"
              value={paymentAmount}
              onChange={e => setPaymentAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>
        )}
      </Sheet>
    </div>
  );
}
