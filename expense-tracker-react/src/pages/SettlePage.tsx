import { useEffect, useMemo, useState } from 'react';
import { useExpenseStore } from '@/stores/expenseStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Sheet, Input, Button, useToast } from '@/components/ui';
import { haptic, cn } from '@/lib/utils';
import * as db from '@/db/operations';
import type { Settlement, Payment, Person } from '@/types';

export function SettlePage() {
  const { expenses, loadAllExpenses } = useExpenseStore();
  const { people, loadPeople, getPersonName } = usePeopleStore();
  const formatAmount = useSettingsStore(s => s.formatAmount);
  const { showSuccess, showError } = useToast();
  
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAllExpenses();
    loadPeople();
    loadPayments();
  }, [loadAllExpenses, loadPeople]);

  const loadPayments = async () => {
    try {
      const p = await db.getPayments();
      setPayments(p);
    } catch (error) {
      console.error('Failed to load payments:', error);
    }
  };

  // Calculate balances and settlements
  const { totalExpenses, sharePerPerson, personSpent, balances, settlements } = useMemo(() => {
    if (people.length === 0 || expenses.length === 0) {
      return { totalExpenses: 0, sharePerPerson: 0, personSpent: {}, balances: {}, settlements: [] };
    }

    const personCount = people.length;
    const personPaid: Record<string, number> = {};
    const personOwes: Record<string, number> = {};
    let total = 0;

    // Calculate what each person paid and owes
    expenses.forEach(expense => {
      const amount = expense.amount;
      total += amount;
      
      // Track what the payer paid
      if (expense.payerId) {
        personPaid[expense.payerId] = (personPaid[expense.payerId] || 0) + amount;
      }
      
      // Equal split among all people
      const share = amount / personCount;
      people.forEach(p => {
        personOwes[p.id] = (personOwes[p.id] || 0) + share;
      });
    });

    // Adjust for payments already made
    payments.forEach(payment => {
      // Payment reduces what 'from' owes and what 'to' is owed
      personOwes[payment.fromId] = (personOwes[payment.fromId] || 0) - payment.amount;
      personOwes[payment.toId] = (personOwes[payment.toId] || 0) + payment.amount;
    });

    // Calculate balances (positive = owed money back, negative = owes money)
    const balanceMap: Record<string, number> = {};
    for (const person of people) {
      const paid = personPaid[person.id] || 0;
      const owes = personOwes[person.id] || 0;
      balanceMap[person.id] = paid - owes;
    }

    // Calculate settlement transactions
    const debtors: { person: Person; amount: number }[] = [];
    const creditors: { person: Person; amount: number }[] = [];

    for (const person of people) {
      const balance = balanceMap[person.id] || 0;
      if (balance < -0.01) {
        debtors.push({ person, amount: -balance });
      } else if (balance > 0.01) {
        creditors.push({ person, amount: balance });
      }
    }

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const settlementList: Settlement[] = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const payment = Math.min(debtor.amount, creditor.amount);

      if (payment > 0.01) {
        settlementList.push({
          from: debtor.person,
          to: creditor.person,
          amount: payment
        });
      }

      debtor.amount -= payment;
      creditor.amount -= payment;

      if (debtor.amount <= 0.01) i++;
      if (creditor.amount <= 0.01) j++;
    }

    return {
      totalExpenses: total,
      sharePerPerson: total / personCount,
      personSpent: personPaid,
      balances: balanceMap,
      settlements: settlementList
    };
  }, [expenses, people, payments]);

  const handleRecordPayment = async () => {
    if (!selectedSettlement) return;
    
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      showError('Enter a valid amount');
      return;
    }

    setSaving(true);
    try {
      await db.addPayment({
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
      loadPayments();
    } catch {
      showError('Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm('Delete this payment record?')) return;
    
    try {
      await db.deletePayment(id);
      haptic('success');
      showSuccess('Payment deleted');
      loadPayments();
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
        ) : expenses.length === 0 ? (
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
