/**
 * Settlement Calculator Module
 */

const Settlement = {
  async init() {
    // Module initialized
  },

  async calculate() {
    try {
      const expenses = await DB.getExpenses();
      const people = await DB.getPeople();

      if (expenses.length === 0) {
        this.renderEmptySettlement();
        return;
      }

      // Calculate total expenses and per-person spending
      const personTotals = {};
      let totalExpenses = 0;

      expenses.forEach(expense => {
        totalExpenses += expense.amount;
        personTotals[expense.payerId] = (personTotals[expense.payerId] || 0) + expense.amount;
      });

      const personCount = people.length;
      const sharePerPerson = totalExpenses / personCount;

      // Calculate balances (positive = owed money, negative = owes money)
      const balances = {};
      for (const person of people) {
        const spent = personTotals[person.id] || 0;
        balances[person.id] = spent - sharePerPerson;
      }

      // Calculate settlement transactions
      const settlements = this.calculateSettlements(balances, people);

      this.renderSettlement(totalExpenses, personTotals, sharePerPerson, settlements, people);

    } catch (error) {
      console.error('Failed to calculate settlement:', error);
      App.showError('Failed to calculate settlement');
    }
  },

  calculateSettlements(balances, people) {
    const settlements = [];
    const debtors = []; // People who owe money
    const creditors = []; // People who are owed money

    // Separate debtors and creditors
    for (const person of people) {
      const balance = balances[person.id] || 0;
      if (balance < -0.01) { // Owes money
        debtors.push({ id: person.id, name: person.name, amount: -balance });
      } else if (balance > 0.01) { // Is owed money
        creditors.push({ id: person.id, name: person.name, amount: balance });
      }
    }

    // Sort by amount (largest first)
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    // Calculate optimal payments
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      const payment = Math.min(debtor.amount, creditor.amount);

      if (payment > 0.01) {
        settlements.push({
          from: debtor.id,
          fromName: debtor.name,
          to: creditor.id,
          toName: creditor.name,
          amount: payment
        });
      }

      debtor.amount -= payment;
      creditor.amount -= payment;

      if (debtor.amount <= 0.01) i++;
      if (creditor.amount <= 0.01) j++;
    }

    return settlements;
  },

  renderEmptySettlement() {
    const resultsElement = document.getElementById('settlement-results');
    if (!resultsElement) return;

    resultsElement.innerHTML = `
      <div class="text-center">
        <p>No expenses to settle yet. Add some expenses first!</p>
      </div>
    `;
  },

  renderSettlement(totalExpenses, personTotals, sharePerPerson, settlements, people) {
    const resultsElement = document.getElementById('settlement-results');
    if (!resultsElement) return;

    const personSpending = people.map(person => ({
      name: person.name,
      spent: personTotals[person.id] || 0,
      balance: (personTotals[person.id] || 0) - sharePerPerson
    }));

    resultsElement.innerHTML = `
      <div class="settlement-summary">
        <div class="summary-stats mb-4">
          <div class="stat-card">
            <h3>Total Expenses</h3>
            <p class="stat-value">$${totalExpenses.toFixed(2)}</p>
          </div>
          <div class="stat-card">
            <h3>Per Person Share</h3>
            <p class="stat-value">$${sharePerPerson.toFixed(2)}</p>
          </div>
        </div>

        <h3 class="mb-3">Individual Spending</h3>
        <div class="spending-list mb-4">
          ${personSpending.map(person => `
            <div class="spending-item flex justify-between">
              <span>${person.name}</span>
              <div class="text-right">
                <div>Spent: $${person.spent.toFixed(2)}</div>
                <div class="balance ${person.balance >= 0 ? 'positive' : 'negative'}">
                  ${person.balance >= 0 ? '+' : ''}$${person.balance.toFixed(2)}
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <h3 class="mb-3">Settlement Plan</h3>
        <div class="settlement-plan">
          ${settlements.length === 0 ?
            '<p class="text-center">Everyone is settled up! 🎉</p>' :
            settlements.map(settlement => `
              <div class="settlement-item">
                <strong>${settlement.fromName}</strong> pays
                <strong>${settlement.toName}</strong>
                <span class="amount">$${settlement.amount.toFixed(2)}</span>
              </div>
            `).join('')
          }
        </div>
      </div>
    `;

    // Add some basic styles for the settlement view
    const style = document.createElement('style');
    style.textContent = `
      .stat-card { background: #f8fafc; padding: 1rem; border-radius: 0.5rem; text-align: center; margin-bottom: 1rem; }
      .stat-value { font-size: 1.5rem; font-weight: bold; color: #2563eb; }
      .spending-item { padding: 0.75rem; border-bottom: 1px solid #e2e8f0; }
      .balance.positive { color: #16a34a; }
      .balance.negative { color: #dc2626; }
      .settlement-item { background: #eff6ff; padding: 1rem; border-radius: 0.5rem; margin-bottom: 0.5rem; }
      .amount { font-weight: bold; color: #2563eb; }
    `;
    document.head.appendChild(style);
  }
};
