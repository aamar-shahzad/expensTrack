/**
 * Settlement calculations - who owes whom
 */
import type { Expense, Person, Payment, Balance, Settlement } from '@/types';

export function computeBalances(
  expenses: Expense[],
  people: Person[],
  payments: Payment[]
): Balance[] {
  if (people.length === 0) return [];

  const personTotals: Record<string, { paid: number; share: number }> = {};
  people.forEach(p => {
    personTotals[p.id] = { paid: 0, share: 0 };
  });

  expenses.forEach(exp => {
    if (!exp.payerId) return;
    if (personTotals[exp.payerId]) {
      personTotals[exp.payerId].paid += exp.amount;
    }
    const sharePerPerson = exp.amount / people.length;
    people.forEach(p => {
      personTotals[p.id].share += sharePerPerson;
    });
  });

  payments.forEach(payment => {
    if (personTotals[payment.fromId]) {
      personTotals[payment.fromId].paid += payment.amount;
    }
    if (personTotals[payment.toId]) {
      personTotals[payment.toId].share += payment.amount;
    }
  });

  return people.map(p => ({
    personId: p.id,
    personName: p.name,
    amount: personTotals[p.id].paid - personTotals[p.id].share
  }));
}

export function computeSettlements(
  balances: Balance[],
  people: Person[]
): Settlement[] {
  const settlements: Settlement[] = [];
  const debtors = balances.filter(b => b.amount < 0).map(b => ({ ...b }));
  const creditors = balances.filter(b => b.amount > 0).map(b => ({ ...b }));

  debtors.forEach(debtor => {
    creditors.forEach(creditor => {
      if (debtor.amount >= 0 || creditor.amount <= 0) return;
      const amount = Math.min(-debtor.amount, creditor.amount);
      if (amount > 0.01) {
        const fromPerson = people.find(p => p.id === debtor.personId);
        const toPerson = people.find(p => p.id === creditor.personId);
        if (fromPerson && toPerson) {
          settlements.push({ from: fromPerson, to: toPerson, amount });
        }
        debtor.amount += amount;
        creditor.amount -= amount;
      }
    });
  });

  return settlements;
}
