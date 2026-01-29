import { useEffect, useMemo, useState } from 'react';
import { useExpenseStore } from '@/stores/expenseStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Sheet, Input, useToast } from '@/components/ui';
import { SettlementView } from '@/components/settlements';
import { haptic } from '@/lib/utils';
import { computeBalances, computeSettlements } from '@/lib/settlements';
import * as db from '@/db/operations';
import type { Settlement, Payment } from '@/types';

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

  // Calculate balances and settlements via lib/settlements
  const { balances, settlements } = useMemo(() => {
    const balancesList = computeBalances(expenses, people, payments);
    const settlementsList = computeSettlements(balancesList, people);
    return { balances: balancesList, settlements: settlementsList };
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

  const openPaymentModal = (settlement: Settlement) => {
    setSelectedSettlement(settlement);
    setPaymentAmount(settlement.amount.toFixed(2));
    setShowPaymentModal(true);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 safe-top">
        <h1 className="text-2xl font-bold mb-2">Settle Up</h1>
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
        ) : (
          <>
            <SettlementView
              balances={balances}
              settlements={settlements}
              formatAmount={formatAmount}
              onRecordPayment={openPaymentModal}
            />

            {/* Recent Payments */}
            {payments.length > 0 && (
              <div className="px-4 mt-6">
                <h2 className="text-lg font-semibold mb-3">Recent Payments</h2>
                <div className="bg-[var(--white)] rounded-xl divide-y divide-[var(--border)]">
                  {payments.slice(0, 5).map(payment => (
                    <div key={payment.id} className="flex items-center gap-3 p-4">
                      <div className="text-xl">💸</div>
                      <div className="flex-1">
                        <div className="font-medium">
                          {getPersonName(payment.fromId)} → {getPersonName(payment.toId)}
                        </div>
                        <div className="text-sm text-[var(--text-secondary)]">{payment.date}</div>
                      </div>
                      <span className="font-semibold">{formatAmount(payment.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
            <div className="text-center mb-4">
              <div className="text-lg">
                <span className="font-semibold">{selectedSettlement.from.name}</span>
                <span className="text-[var(--text-secondary)]"> pays </span>
                <span className="font-semibold">{selectedSettlement.to.name}</span>
              </div>
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
