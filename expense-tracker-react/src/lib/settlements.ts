/**
 * Settlement calculations - who owes whom
 */
import type { Expense, Person, Payment, Balance, Settlement } from '@/types';

// Round to 2 decimal places for currency precision
const roundCurrency = (amount: number) => Math.round(amount * 100) / 100;

// Threshold for considering amounts as zero (half a cent)
const EPSILON = 0.005;

/**
 * Compute balances for each person based on expenses and payments.
 * Positive balance = person is owed money (they paid more than their share)
 * Negative balance = person owes money (they paid less than their share)
 */
export function computeBalances(
  expenses: Expense[],
  people: Person[],
  payments: Payment[]
): Balance[] {
  if (people.length === 0) return [];

  const personTotals: Record<string, { paid: number; owes: number }> = {};
  
  // Initialize all people
  people.forEach(p => {
    personTotals[p.id] = { paid: 0, owes: 0 };
  });

  // Process each expense
  expenses.forEach(exp => {
    // Track what the payer paid
    if (exp.payerId && personTotals[exp.payerId]) {
      personTotals[exp.payerId].paid += exp.amount;
    }

    // Determine split participants
    let splitParticipants: string[];
    
    if (exp.splitType === 'full' && exp.payerId) {
      // Full means only the payer owes (no split with others)
      splitParticipants = [exp.payerId];
    } else if (exp.splitWith && exp.splitWith.length > 0) {
      // Custom split participants
      splitParticipants = exp.splitWith.filter(id => personTotals[id]);
    } else {
      // Default: equal split among all people
      splitParticipants = people.map(p => p.id);
    }

    // Fallback if no valid participants
    if (splitParticipants.length === 0) {
      splitParticipants = people.map(p => p.id);
    }

    // Calculate shares
    if (exp.splitType === 'custom' && exp.splitDetails) {
      // Custom amounts per person
      for (const [personId, shareAmount] of Object.entries(exp.splitDetails)) {
        if (personTotals[personId]) {
          personTotals[personId].owes += shareAmount;
        }
      }
    } else {
      // Equal split among participants
      const share = roundCurrency(exp.amount / splitParticipants.length);
      splitParticipants.forEach(personId => {
        if (personTotals[personId]) {
          personTotals[personId].owes += share;
        }
      });
    }
  });

  // Adjust for payments already made
  // When A pays B: A effectively "paid" more, B's share increases (cancels their credit)
  payments.forEach(payment => {
    if (personTotals[payment.fromId]) {
      personTotals[payment.fromId].paid += payment.amount;
    }
    if (personTotals[payment.toId]) {
      personTotals[payment.toId].owes += payment.amount;
    }
  });

  // Calculate final balances
  return people.map(p => ({
    personId: p.id,
    personName: p.name,
    amount: roundCurrency(personTotals[p.id].paid - personTotals[p.id].owes)
  }));
}

/**
 * Compute optimal settlement transactions to balance all debts.
 * Uses a greedy algorithm to minimize the number of transactions.
 */
export function computeSettlements(
  balances: Balance[],
  people: Person[]
): Settlement[] {
  const settlements: Settlement[] = [];
  
  // Separate into debtors (negative balance) and creditors (positive balance)
  const debtors = balances
    .filter(b => b.amount < -EPSILON)
    .map(b => ({ ...b, amount: roundCurrency(-b.amount) })); // Convert to positive for easier math
  
  const creditors = balances
    .filter(b => b.amount > EPSILON)
    .map(b => ({ ...b, amount: roundCurrency(b.amount) }));

  // Sort by amount descending for optimal settlement
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  // Greedy matching
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const paymentAmount = roundCurrency(Math.min(debtor.amount, creditor.amount));

    if (paymentAmount > EPSILON) {
      const fromPerson = people.find(p => p.id === debtor.personId);
      const toPerson = people.find(p => p.id === creditor.personId);
      
      if (fromPerson && toPerson) {
        settlements.push({
          from: fromPerson,
          to: toPerson,
          amount: paymentAmount
        });
      }
    }

    debtor.amount = roundCurrency(debtor.amount - paymentAmount);
    creditor.amount = roundCurrency(creditor.amount - paymentAmount);

    if (debtor.amount <= EPSILON) i++;
    if (creditor.amount <= EPSILON) j++;
  }

  return settlements;
}

/**
 * Calculate summary statistics for a group of expenses
 */
export function computeExpenseStats(
  expenses: Expense[],
  people: Person[]
): { total: number; perPerson: number; personSpent: Record<string, number> } {
  const personSpent: Record<string, number> = {};
  let total = 0;

  people.forEach(p => {
    personSpent[p.id] = 0;
  });

  expenses.forEach(exp => {
    total += exp.amount;
    if (exp.payerId && personSpent[exp.payerId] !== undefined) {
      personSpent[exp.payerId] += exp.amount;
    }
  });

  return {
    total: roundCurrency(total),
    perPerson: people.length > 0 ? roundCurrency(total / people.length) : 0,
    personSpent
  };
}
