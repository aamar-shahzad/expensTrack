import type { Settlement } from '@/types';
import { Button } from '@/components/ui';
import { BalanceCard } from './BalanceCard';
import type { Balance } from '@/types';

interface SettlementViewProps {
  balances: Balance[];
  settlements: Settlement[];
  formatAmount: (amount: number) => string;
  onRecordPayment: (settlement: Settlement) => void;
}

export function SettlementView({
  balances,
  settlements,
  formatAmount,
  onRecordPayment
}: SettlementViewProps) {
  return (
    <>
      {/* Balances */}
      <div className="px-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Balances</h2>
        <div className="bg-[var(--white)] rounded-xl divide-y divide-[var(--border)]">
          {balances.map(balance => (
            <BalanceCard
              key={balance.personId}
              balance={balance}
              formatAmount={formatAmount}
            />
          ))}
        </div>
      </div>

      {/* Settlements (Suggested Payments) */}
      {settlements.length > 0 && (
        <div className="px-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Suggested Payments</h2>
          <div className="space-y-3">
            {settlements.map((settlement, i) => (
              <div key={i} className="bg-[var(--white)] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--danger)]/10 text-[var(--danger)] flex items-center justify-center text-sm font-bold">
                    {settlement.from.name.charAt(0)}
                  </div>
                  <span className="text-[var(--text-secondary)]">→</span>
                  <div className="w-8 h-8 rounded-full bg-[var(--teal-green)]/10 text-[var(--teal-green)] flex items-center justify-center text-sm font-bold">
                    {settlement.to.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <span className="font-medium">{settlement.from.name}</span>
                    <span className="text-[var(--text-secondary)]"> pays </span>
                    <span className="font-medium">{settlement.to.name}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {formatAmount(settlement.amount)}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => onRecordPayment(settlement)}
                  >
                    Record Payment
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {settlements.length === 0 && (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">✅</div>
          <h3 className="font-semibold mb-1">All settled up!</h3>
          <p className="text-[var(--text-secondary)] text-sm">
            No payments needed
          </p>
        </div>
      )}
    </>
  );
}
