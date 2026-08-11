const totalUsers = document.getElementById('totalUsers');
const totalBalance = document.getElementById('totalBalance');
const userCountTag = document.getElementById('userCountTag');
const usersTable = document.getElementById('usersTable');
const transactionsTable = document.getElementById('transactionsTable');
const userSelect = document.getElementById('userSelect');
const addUserForm = document.getElementById('addUserForm');
const transactionForm = document.getElementById('transactionForm');
const refreshButton = document.getElementById('refreshButton');

const api = {
  users: '/api/users',
  transactions: (userId) => `/api/transactions/${userId}`,
  createUser: '/api/users',
  createTransaction: '/api/transactions'
};

async function fetchUsers() {
  const res = await fetch(api.users);
  return res.ok ? res.json() : [];
}

async function fetchTransactions(userId) {
  const res = await fetch(api.transactions(userId));
  return res.ok ? res.json() : [];
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(value);
}

function createUserRow(user) {
  return `
    <tr>
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td>${formatCurrency(user.balance)}</td>
      <td><button class="button button-secondary button-sm" onclick="loadTransactions(${user.id}, '${user.name}')">Details</button></td>
    </tr>
  `;
}

function createTransactionRow(tx, userName) {
  const directionClass = tx.type === 'deposit' ? 'type-deposit' : 'type-withdraw';
  return `
    <tr>
      <td>${userName}</td>
      <td class="${directionClass}">${tx.type}</td>
      <td>${formatCurrency(tx.amount)}</td>
      <td>${tx.description || '—'}</td>
      <td>${new Date(tx.created_at).toLocaleString()}</td>
    </tr>
  `;
}

async function refreshData() {
  const users = await fetchUsers();
  const total = users.reduce((sum, user) => sum + Number(user.balance), 0);

  totalUsers.textContent = users.length;
  totalBalance.textContent = formatCurrency(total);
  userCountTag.textContent = `${users.length} users`;

  usersTable.innerHTML = users.map(createUserRow).join('');
  userSelect.innerHTML = '<option value="">Select user</option>' +
    users.map((user) => `<option value="${user.id}">${user.name} (${user.email})</option>`).join('');

  const recentTransactions = [];
  for (const user of users) {
    const transactions = await fetchTransactions(user.id);
    transactions.forEach((tx) => {
      recentTransactions.push({ ...tx, userName: user.name });
    });
  }

  recentTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  transactionsTable.innerHTML = recentTransactions.slice(0, 10).map((tx) => createTransactionRow(tx, tx.userName)).join('');
}

async function loadTransactions(userId, userName) {
  const transactions = await fetchTransactions(userId);
  transactionsTable.innerHTML = transactions.map((tx) => createTransactionRow(tx, userName)).join('');
}

addUserForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(addUserForm);
  const payload = {
    name: form.get('name').trim(),
    email: form.get('email').trim()
  };

  const res = await fetch(api.createUser, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    addUserForm.reset();
    refreshData();
  } else {
    const error = await res.json();
    alert(error.error || 'Unable to add user.');
  }
});

transactionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    userId: Number(userSelect.value),
    type: transactionForm.transactionType.value,
    amount: Number(document.getElementById('amountInput').value),
    description: document.getElementById('descriptionInput').value.trim()
  };

  const res = await fetch(api.createTransaction, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    transactionForm.reset();
    refreshData();
  } else {
    const error = await res.json();
    alert(error.error || 'Unable to submit transaction.');
  }
});

refreshButton.addEventListener('click', refreshData);
window.addEventListener('load', refreshData);
