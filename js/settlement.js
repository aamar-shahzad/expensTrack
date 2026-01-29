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

      // Calculate what each person paid and what they owe
      const personPaid = {};  // What each person actually paid
      const personOwes = {};  // What each person should have paid (their share)
      let totalExpenses = 0;
      const personCount = people.length;

      expenses.forEach(expense => {
        const amount = parseFloat(expense.amount);
        totalExpenses += amount;
        
        // Track what the payer paid
        personPaid[expense.payerId] = (personPaid[expense.payerId] || 0) + amount;
        
        // Calculate what each person owes based on split type
        const splitType = expense.splitType || 'equal';
        
        if (splitType === 'equal') {
          // Split equally among all people
          const share = amount / personCount;
          people.forEach(p => {
            personOwes[p.id] = (personOwes[p.id] || 0) + share;
          });
        } else if (splitType === 'full') {
          // Payer paid for someone else - they owe nothing, others split it
          const othersCount = personCount - 1;
          if (othersCount > 0) {
            const share = amount / othersCount;
            people.forEach(p => {
              if (p.id !== expense.payerId) {
                personOwes[p.id] = (personOwes[p.id] || 0) + share;
              }
            });
          }
        } else if (splitType === 'custom' && expense.splitDetails) {
          // Custom percentage split
          people.forEach(p => {
            const percent = expense.splitDetails[p.id] || 0;
            personOwes[p.id] = (personOwes[p.id] || 0) + (amount * percent / 100);
          });
        } else {
          // Fallback to equal split
          const share = amount / personCount;
          people.forEach(p => {
            personOwes[p.id] = (personOwes[p.id] || 0) + share;
          });
        }
      });

      // Calculate balances (positive = owed money back, negative = owes money)
      const balances = {};
      for (const person of people) {
        const paid = personPaid[person.id] || 0;
        const owes = personOwes[person.id] || 0;
        balances[person.id] = paid - owes;
      }

      // Calculate settlement transactions
      const settlements = this.calculateSettlements(balances, people);
      
      // Calculate average share for display
      const sharePerPerson = totalExpenses / personCount;

      this.renderSettlement(totalExpenses, personPaid, sharePerPerson, settlements, people, balances);

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
          settlements.map((s, i) => `
            <div class="settle-payment" data-index="${i}">
              <div class="settle-payment-info">
                <div class="settle-payment-from">${s.from}</div>
                <div class="settle-payment-arrow">→</div>
                <div class="settle-payment-to">${s.to}</div>
              </div>
              <div class="settle-payment-right">
                <div class="settle-payment-amount">${Settings.formatAmount(s.amount)}</div>
                <button class="settle-mark-paid" onclick="Settlement.markAsPaid('${s.from}', '${s.to}', ${s.amount})">
                  Mark Paid
                </button>
              </div>
            </div>
          `).join('')
        }
      </div>

      <div class="settle-section">
        <div class="settle-section-title">Payment History</div>
        <div id="payment-history">Loading...</div>
      </div>

      <button class="btn-secondary" style="width:100%;margin-top:16px" onclick="Expenses.exportToCSV()">
        Export All Expenses (CSV)
      </button>
    `;
    
    // Load payment history
    this.loadPaymentHistory();
  },

  async markAsPaid(from, to, amount) {
    try {
      await DB.addPayment({
        from,
        to,
        amount,
        date: new Date().toISOString().split('T')[0]
      });
      
      App.showSuccess(`Payment recorded: ${from} → ${to}`);
      this.loadPaymentHistory();
    } catch (e) {
      console.error('Failed to record payment:', e);
      App.showError('Failed to record payment');
    }
  },

  async loadPaymentHistory() {
    const container = document.getElementById('payment-history');
    if (!container) return;
    
    try {
      const payments = await DB.getPayments();
      
      if (payments.length === 0) {
        container.innerHTML = '<div class="settle-done">No payments recorded yet</div>';
        return;
      }
      
      container.innerHTML = payments.slice(0, 10).map(p => `
        <div class="payment-history-item">
          <div class="payment-history-info">
            <div class="payment-history-names">${p.from} → ${p.to}</div>
            <div class="payment-history-date">${this.formatDate(p.date)}</div>
          </div>
          <div class="payment-history-right">
            <div class="payment-history-amount">${Settings.formatAmount(p.amount)}</div>
            <button class="payment-delete-btn" onclick="Settlement.deletePayment('${p.id}')">✕</button>
          </div>
        </div>
      `).join('');
      
      if (payments.length > 10) {
        container.innerHTML += `<div style="text-align:center;padding:8px;color:var(--text-secondary);font-size:13px">
          + ${payments.length - 10} more payments
        </div>`;
      }
    } catch (e) {
      container.innerHTML = '<div style="color:#ff3b30">Failed to load history</div>';
    }
  },

  async deletePayment(id) {
    if (!confirm('Delete this payment record?')) return;
    
    try {
      await DB.deletePayment(id);
      this.loadPaymentHistory();
      App.showSuccess('Payment deleted');
    } catch (e) {
      App.showError('Failed to delete');
    }
  },

  formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
};
