document.addEventListener('DOMContentLoaded', () => {
    let currentUser = null;
    let currentRole = 'user';
    const originalFetch = window.fetch;
    window.fetch = function() {
        let [resource, config] = arguments;
        if(currentUser) {
            if(!config) config = {};
            if(!config.headers) config.headers = {};
            if (config.headers instanceof Headers) {
                config.headers.append('x-user-id', currentUser);
            } else {
                config.headers['x-user-id'] = currentUser;
            }
        }
        return originalFetch(resource, config);
    };

    // Users Screen Elements
    const usersScreen = document.getElementById('users-screen');
    const appContainer = document.getElementById('app-container');
    const usersGrid = document.getElementById('users-grid');
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const authUsername = document.getElementById('auth-username');
    const authMode = document.getElementById('auth-mode');
    const authPassword = document.getElementById('auth-password');
    const newUsernameInput = document.getElementById('new-username');
    const usernameGroup = document.getElementById('username-group');
    const authTitle = document.getElementById('auth-title');
    const authError = document.getElementById('auth-error');
    const authSubmit = document.getElementById('auth-submit');
    
    // Switch User functionality
    document.getElementById('switch-user-btn').addEventListener('click', () => {
        currentUser = null;
        currentRole = 'user';
        document.getElementById('admin-dashboard-btn').classList.add('hidden');
        const userLabel = document.getElementById('logged-in-user');
        if (userLabel) userLabel.textContent = '';
        usersScreen.classList.remove('hidden');
        appContainer.classList.add('hidden');
        loadUsersScreen();
    });

    document.getElementById('auth-cancel').addEventListener('click', () => {
        authModal.classList.add('hidden');
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mode = authMode.value;
        const pass = authPassword.value;
        let user = authUsername.value;
        
        if (mode === 'login') {
            try {
                const res = await originalFetch('/api/login', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({username: user, password: pass})
                });
                const data = await res.json();
                if (res.ok && data.status === 'success') {
                    login(user, data.role);
                } else {
                    authError.textContent = data.message || 'Login failed';
                    authError.classList.remove('hidden');
                }
            } catch(e) {
                authError.textContent = 'Network error';
                authError.classList.remove('hidden');
            }
        } else if (mode === 'setup') {
            // First-time setup: create admin account
            user = newUsernameInput.value.trim();
            if (!user) {
                authError.textContent = 'Username is required';
                authError.classList.remove('hidden');
                return;
            }
            try {
                const res = await originalFetch('/api/users/add', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({username: user, password: pass, role: 'admin'})
                });
                const data = await res.json();
                if (res.ok && data.status === 'success') {
                    authError.classList.add('hidden');
                    // Now log in automatically
                    const loginRes = await originalFetch('/api/login', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({username: user, password: pass})
                    });
                    const loginData = await loginRes.json();
                    if (loginRes.ok && loginData.status === 'success') {
                        login(user, loginData.role);
                    } else {
                        // Account created; reload to login normally
                        authModal.classList.add('hidden');
                        loadUsersScreen();
                    }
                } else {
                    authError.textContent = data.message || 'Setup failed';
                    authError.classList.remove('hidden');
                }
            } catch(err) {
                authError.textContent = 'Network error';
                authError.classList.remove('hidden');
            }
        }
    });

    const adminDashboardBtn = document.getElementById('admin-dashboard-btn');

    function login(user, role) {
        currentUser = user;
        currentRole = role || 'user';
        authModal.classList.add('hidden');
        usersScreen.classList.add('hidden');
        appContainer.classList.remove('hidden');
        authPassword.value = '';

        // Show logged-in user in header
        const userLabel = document.getElementById('logged-in-user');
        if (userLabel) userLabel.textContent = `👤 ${user}`;
        
        if (currentRole === 'admin') {
            adminDashboardBtn.classList.remove('hidden');
        } else {
            adminDashboardBtn.classList.add('hidden');
        }

        // Clear and reload categories (prevent duplication on user switch)
        categorySelect.innerHTML = '';
        budgetCategorySelect.innerHTML = '';

        // Init App for user
        loadCategories();
        loadSummary();
        loadTransactions();
    }

    async function loadUsersScreen() {
        usersGrid.innerHTML = '';
        try {
            const res = await originalFetch('/api/users');
            const users = await res.json();
            
            if (users.length === 0) {
                // First-run: no users exist yet — show setup prompt
                usersGrid.innerHTML = `
                    <div class="setup-card glass-card" style="text-align:center; padding: 2.5rem 3rem; max-width: 420px;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">🚀</div>
                        <h2 style="justify-content:center; margin-bottom:0.5rem;">First-Time Setup</h2>
                        <p style="color:var(--text-muted); margin-bottom:1.5rem; font-size:0.95rem;">
                            No accounts found. Create your admin account to get started.
                        </p>
                        <button id="setup-admin-btn" class="btn-primary" style="width:auto; padding: 0.75rem 2rem;">
                            ✨ Create Admin Account
                        </button>
                    </div>
                `;
                document.getElementById('setup-admin-btn').addEventListener('click', () => {
                    authMode.value = 'setup';
                    authUsername.value = '';
                    authTitle.textContent = 'Create Admin Account';
                    usernameGroup.style.display = 'block';
                    newUsernameInput.required = true;
                    newUsernameInput.placeholder = 'Admin username';
                    authPassword.value = '';
                    authError.classList.add('hidden');
                    authSubmit.textContent = 'Create & Login';
                    authModal.classList.remove('hidden');
                });
                return;
            }

            users.forEach((item, index) => {
                const u = typeof item === 'string' ? item : item.username;
                const r = typeof item === 'string' ? 'user' : item.role;
                const div = document.createElement('div');
                div.className = 'user-profile';
                const gradClass = 'bg-gradient-' + (index % 5);
                const initial = u.charAt(0).toUpperCase();
                
                div.innerHTML = `
                    <div class="avatar ${gradClass}">${initial}</div>
                    <span class="user-name">${u}</span>
                `;
                
                div.addEventListener('click', () => {
                    authMode.value = 'login';
                    authUsername.value = u;
                    authTitle.textContent = `Welcome back, ${u}`;
                    usernameGroup.style.display = 'none';
                    newUsernameInput.required = false;
                    authPassword.value = '';
                    authError.classList.add('hidden');
                    authSubmit.textContent = 'Login';
                    authModal.classList.remove('hidden');
                });
                usersGrid.appendChild(div);
            });
        } catch (e) {
            console.error('Failed to load users');
            usersGrid.innerHTML = `<p style="color:var(--danger); text-align:center;">Could not connect to server. Is the app running?</p>`;
        }
    }

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

    // Admin Dashboard Logic
    const adminModal = document.getElementById('admin-modal');
    const adminUserList = document.getElementById('admin-user-list');
    const adminAddUserForm = document.getElementById('admin-add-user-form');
    const adminError = document.getElementById('admin-error');

    adminDashboardBtn?.addEventListener('click', () => {
        loadAdminUsers();
        adminModal.classList.remove('hidden');
    });

    document.getElementById('admin-close')?.addEventListener('click', () => {
        adminModal.classList.add('hidden');
    });

    async function loadAdminUsers() {
        adminUserList.innerHTML = '';
        try {
            const res = await originalFetch('/api/users');
            const users = await res.json();
            
            users.forEach(item => {
                const u = item.username;
                const r = item.role;
                const li = document.createElement('li');
                li.className = 'transaction-item';
                
                li.innerHTML = `
                    <div class="t-info">
                        <span class="t-category">${u}</span>
                        <span class="t-desc">Role: ${r}</span>
                    </div>
                    <div class="t-right">
                        ${u !== 'admin' ? `
                            <button class="btn-secondary rename-user-btn" data-user="${u}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-right: 0.5rem;">Rename</button>
                            <button class="delete-user-btn delete-btn" data-user="${u}">
                                <i data-lucide="trash-2"></i>
                            </button>
                        ` : '<span class="t-desc" style="color:var(--text-muted)">Super User</span>'}
                    </div>
                `;
                adminUserList.appendChild(li);
            });
            lucide.createIcons();
        } catch (e) {
            console.error('Failed to load admin users', e);
        }
    }

    adminAddUserForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('admin-new-username').value.trim();
        const password = document.getElementById('admin-new-password').value;
        const role = document.getElementById('admin-new-role').value;

        if (!username) {
            adminError.textContent = 'Username cannot be empty';
            adminError.classList.remove('hidden');
            return;
        }

        try {
            // Use patched fetch so x-user-id header is automatically added
            const res = await fetch('/api/users/add', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username, password, role})
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                adminAddUserForm.reset();
                adminError.classList.add('hidden');
                loadAdminUsers();
                // Refresh user selection screen data in background
            } else {
                adminError.textContent = data.message || 'Error creating user';
                adminError.classList.remove('hidden');
            }
        } catch (err) {
            adminError.textContent = 'Network error';
            adminError.classList.remove('hidden');
        }
    });

    adminUserList?.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-user-btn');
        if (deleteBtn) {
            const user = deleteBtn.getAttribute('data-user');
            if (confirm(`Are you sure you want to delete user '${user}'? This will delete all their data.`)) {
                try {
                    // Use patched fetch so x-user-id header is sent for auth
                    const res = await fetch(`/api/users/${user}`, { method: 'DELETE' });
                    if (res.ok) {
                        loadAdminUsers();
                    } else {
                        const data = await res.json().catch(() => ({}));
                        alert(data.message || 'Failed to delete user.');
                    }
                } catch (err) {
                    console.error('Network Error', err);
                }
            }
            return;
        }

        const renameBtn = e.target.closest('.rename-user-btn');
        if (renameBtn) {
            const user = renameBtn.getAttribute('data-user');
            const newName = prompt(`Enter new username for '${user}':`);
            if (newName && newName.trim() !== '') {
                try {
                    // Use patched fetch so x-user-id header is sent for auth
                    const res = await fetch(`/api/users/${user}/rename`, {
                        method: 'PUT',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({newUsername: newName.trim()})
                    });
                    const data = await res.json();
                    if (res.ok && data.status === 'success') {
                        loadAdminUsers();
                    } else {
                        alert(data.message || 'Failed to rename user.');
                    }
                } catch (err) {
                    console.error('Network Error', err);
                }
            }
        }
    });

    // Init
    loadUsersScreen();
});
