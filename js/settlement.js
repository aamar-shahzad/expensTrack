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

      if (people.length === 0) {
        this.renderEmpty('Add people first to see settlements');
        return;
      }

      if (expenses.length === 0) {
        this.renderEmpty('No expenses yet. Add some expenses to calculate settlements.');
        return;
      }

      // Calculate total expenses and per-person spending
      const personTotals = {};
      let totalExpenses = 0;

      expenses.forEach(expense => {
        totalExpenses += parseFloat(expense.amount);
        personTotals[expense.payerId] = (personTotals[expense.payerId] || 0) + parseFloat(expense.amount);
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

      this.renderSettlement(totalExpenses, personTotals, sharePerPerson, settlements, people, balances);

    } catch (error) {
      console.error('Failed to calculate settlement:', error);
      App.showError('Failed to calculate settlement');
    }
  },

  calculateSettlements(balances, people) {
    const settlements = [];
    const debtors = [];
    const creditors = [];

    for (const person of people) {
      const balance = balances[person.id] || 0;
      if (balance < -0.01) {
        debtors.push({ id: person.id, name: person.name, amount: -balance });
      } else if (balance > 0.01) {
        creditors.push({ id: person.id, name: person.name, amount: balance });
      }
    }

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const payment = Math.min(debtor.amount, creditor.amount);

      if (payment > 0.01) {
        settlements.push({
          from: debtor.name,
          to: creditor.name,
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

  renderEmpty(message) {
    const el = document.getElementById('settlement-results');
    if (!el) return;

    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💰</div>
        <div class="empty-title">No settlements</div>
        <div class="empty-text">${message}</div>
      </div>
    `;
  },

  renderSettlement(totalExpenses, personTotals, sharePerPerson, settlements, people, balances) {
    const el = document.getElementById('settlement-results');
    if (!el) return;
    
    const currency = Settings.getCurrency();

    el.innerHTML = `
      <div class="settle-summary">
        <div class="settle-stat">
          <div class="settle-stat-label">Total Spent</div>
          <div class="settle-stat-value">${Settings.formatAmount(totalExpenses)}</div>
        </div>
        <div class="settle-stat">
          <div class="settle-stat-label">Per Person</div>
          <div class="settle-stat-value">${Settings.formatAmount(sharePerPerson)}</div>
        </div>
      </div>

      <div class="settle-section">
        <div class="settle-section-title">Who Spent What</div>
        ${people.map(p => {
          const spent = personTotals[p.id] || 0;
          const balance = balances[p.id] || 0;
          const balanceClass = balance > 0.01 ? 'positive' : balance < -0.01 ? 'negative' : '';
          const balanceText = balance > 0.01 ? `gets back ${Settings.formatAmount(balance)}` : 
                              balance < -0.01 ? `owes ${Settings.formatAmount(-balance)}` : 'settled';
          return `
            <div class="settle-person">
              <div class="settle-person-avatar">${p.name.charAt(0).toUpperCase()}</div>
              <div class="settle-person-info">
                <div class="settle-person-name">${p.name}</div>
                <div class="settle-person-spent">Spent ${Settings.formatAmount(spent)}</div>
              </div>
              <div class="settle-person-balance ${balanceClass}">${balanceText}</div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="settle-section">
        <div class="settle-section-title">Settlement Plan</div>
        ${settlements.length === 0 ? 
          '<div class="settle-done">Everyone is settled up!</div>' :
          settlements.map(s => `
            <div class="settle-payment">
              <div class="settle-payment-from">${s.from}</div>
              <div class="settle-payment-arrow">→</div>
              <div class="settle-payment-to">${s.to}</div>
              <div class="settle-payment-amount">${Settings.formatAmount(s.amount)}</div>
            </div>
          `).join('')
        }
      </div>

      <button class="btn-secondary" style="width:100%;margin-top:16px" onclick="Expenses.exportToCSV()">
        Export All Expenses (CSV)
      </button>
    `;
  }
};
