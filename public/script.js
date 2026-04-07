document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const form = document.getElementById('transaction-form');
    const budgetForm = document.getElementById('budget-form');
    const categorySelect = document.getElementById('category');
    const budgetCategorySelect = document.getElementById('budget-category');
    const transactionList = document.getElementById('transaction-list');
    const budgetBreakdown = document.getElementById('budget-breakdown');
    
    const balanceEl = document.getElementById('net-savings');
    const incomeEl = document.getElementById('total-income');
    const expenseEl = document.getElementById('total-expense');
    const warningBanner = document.getElementById('warning-message');
    const warningText = document.getElementById('warning-text');
    
    // Chart Instance
    let expenseChart = null;

    // Base API URL
    const API = '/api';

    // Format money
    const formatMoney = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    };

    // Format Date
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    };

    // Fetch and populate suggested categories
    async function loadCategories() {
        try {
            const res = await fetch(`${API}/categories`);
            const categories = await res.json();
            
            categories.forEach(cat => {
                const opt1 = document.createElement('option');
                opt1.value = cat;
                opt1.textContent = cat;
                categorySelect.appendChild(opt1);

                const opt2 = document.createElement('option');
                opt2.value = cat;
                opt2.textContent = cat;
                budgetCategorySelect.appendChild(opt2);
            });
        } catch (error) {
            console.error('Failed to load categories', error);
        }
    }

    // Load Summary and Budgets
    async function loadSummary() {
        try {
            const res = await fetch(`${API}/summary`);
            const summary = await res.json();

            // Update Cards
            balanceEl.textContent = formatMoney(summary.netSavings);
            incomeEl.textContent = '+' + formatMoney(summary.totalIncome);
            expenseEl.textContent = '-' + formatMoney(summary.totalExpense);

            // Warning
            if (summary.warning) {
                warningBanner.classList.remove('hidden');
                warningText.textContent = summary.warning;
            } else {
                warningBanner.classList.add('hidden');
            }

            // Breakdown UI
            budgetBreakdown.innerHTML = '';
            
            if (summary.breakdown.length === 0) {
                budgetBreakdown.innerHTML = '<div class="empty-state">No data available yet.</div>';
                return;
            }

            summary.breakdown.forEach(b => {
                const pct = b.budget > 0 ? Math.min((b.spent / b.budget) * 100, 100) : 0;
                
                const html = `
                    <div class="budget-item">
                        <div class="budget-header">
                            <span class="budget-category">${b.category}</span>
                            <span class="status-badge status-${b.status}">${b.status.replace('_', ' ')}</span>
                        </div>
                        <div class="budget-amounts">
                            ${formatMoney(b.spent)} spent / ${b.budget > 0 ? formatMoney(b.budget) : 'No limit'}
                        </div>
                        ${b.budget > 0 ? `
                        <div class="progress-bar-container">
                            <div class="progress-bar bg-${b.status}" style="width: ${pct}%"></div>
                        </div>
                        <div style="font-size:0.8rem; color:var(--text-muted); text-align:right;">
                            ${formatMoney(b.remaining)} remaining
                        </div>
                        ` : ''}
                    </div>
                `;
                budgetBreakdown.innerHTML += html;
            });
            lucide.createIcons();

            // Update Chart
            updateChart(summary.breakdown);

        } catch (error) {
            console.error('Failed to load summary', error);
        }
    }

    // Chart.js Update Logic
    function updateChart(breakdownData) {
        const ctx = document.getElementById('expenseChart');
        if (!ctx) return;

        const labels = breakdownData.map(b => b.category);
        const spentData = breakdownData.map(b => b.spent);
        const budgetData = breakdownData.map(b => b.budget > 0 ? b.budget : 0);

        if (expenseChart) {
            expenseChart.destroy();
        }

        expenseChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Spent (₹)',
                        data: spentData,
                        backgroundColor: '#ff4757', // var(--danger)
                        borderRadius: 4
                    },
                    {
                        label: 'Budget Limit (₹)',
                        data: budgetData,
                        backgroundColor: 'rgba(160, 160, 184, 0.3)', // var(--text-muted) with opacity
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#a0a0b8' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#a0a0b8' }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#f0f0f5' } }
                }
            }
        });
    }

    // Load Transactions
    async function loadTransactions() {
        try {
            const res = await fetch(`${API}/transactions`);
            const transactions = await res.json();
            
            transactionList.innerHTML = '';
            
            if (transactions.length === 0) {
                transactionList.innerHTML = '<div class="empty-state">No transactions yet.</div>';
                return;
            }

            // Sort newest first technically C++ keeps order, we'll reverse it
            transactions.reverse().forEach(t => {
                const li = document.createElement('li');
                li.className = 'transaction-item';
                const typeClass = t.type === 'INCOME' ? 'income' : 'expense';
                const sign = t.type === 'INCOME' ? '+' : '-';
                
                li.innerHTML = `
                    <div class="t-info">
                        <span class="t-category">${t.category}</span>
                        <span class="t-date">${formatDate(t.date)}</span>
                        ${t.description ? `<span class="t-desc">${t.description}</span>` : ''}
                    </div>
                    <div class="t-right">
                        <span class="t-amount ${typeClass}">${sign}${formatMoney(t.amount)}</span>
                        <button class="delete-btn" data-id="${t.id}">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                `;
                transactionList.appendChild(li);
            });
            lucide.createIcons();
        } catch (error) {
            console.error('Failed to load transactions', error);
        }
    }

    // Submit Transaction
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const type = document.querySelector('input[name="type"]:checked').value;
        const category = document.getElementById('category').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const date = document.getElementById('date').value;
        const description = document.getElementById('description').value;

        try {
            await fetch(`${API}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, category, amount, date, description })
            });
            
            form.reset();
            // Default select re-selection
            document.getElementById('type-expense').checked = true;
            
            // Reload UI
            loadSummary();
            loadTransactions();
        } catch (error) {
            console.error('Error adding transaction', error);
        }
    });

    // Submit Budget
    budgetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const category = document.getElementById('budget-category').value;
        const amount = parseFloat(document.getElementById('budget-amount').value);

        try {
            await fetch(`${API}/budgets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, amount })
            });
            
            document.getElementById('budget-amount').value = '';
            
            // Reload UI
            loadSummary();
        } catch (error) {
            console.error('Error adding budget', error);
        }
    });

    // Global Delete function via Event Delegation
    transactionList.addEventListener('click', async (e) => {
        const btn = e.target.closest('.delete-btn');
        if (!btn) return;
        
        const id = btn.getAttribute('data-id');
        if (!id) return;

        if (!confirm('Are you sure you want to delete this transaction?')) return;
        
        try {
            await fetch(`${API}/transactions/${id}`, { method: 'DELETE' });
            loadSummary();
            loadTransactions();
        } catch (error) {
            console.error('Error deleting transaction', error);
        }
    });

    // Init
    loadCategories();
    loadSummary();
    loadTransactions();
});
