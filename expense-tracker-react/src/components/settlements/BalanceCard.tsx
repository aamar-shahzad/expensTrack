import type { Balance } from '@/types';

interface BalanceCardProps {
  balance: Balance;
  formatAmount: (amount: number) => string;
}

export function BalanceCard({ balance, formatAmount }: BalanceCardProps) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="w-10 h-10 rounded-full bg-[var(--teal-green)] text-white flex items-center justify-center font-bold">
        {balance.personName.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1">
        <div className="font-medium">{balance.personName}</div>
      </div>
      <div
        className={`font-semibold ${
          balance.amount > 0
            ? 'text-[var(--teal-green)]'
            : balance.amount < 0
              ? 'text-[var(--danger)]'
              : ''
        }`}
      >
        {balance.amount > 0 ? '+' : ''}
        {formatAmount(balance.amount)}
      </div>
    </div>
  );
}
