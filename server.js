const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
const dbFile = path.join(__dirname, 'wallet.db');
const db = new sqlite3.Database(dbFile);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
const initSql = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  balance REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`;

db.exec(initSql, (err) => {
  if (err) {
    console.error('Database initialization failed:', err.message);
    process.exit(1);
  }
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/users', (req, res) => {
  db.all('SELECT id, name, email, balance FROM users', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  const stmt = db.prepare('INSERT INTO users (name, email, balance) VALUES (?, ?, 0)');
  stmt.run(name, email, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, email, balance: 0 });
  });
  stmt.finalize();
});

app.post('/api/transactions', (req, res) => {
  const { userId, type, amount, description } = req.body;
  if (!userId || !type || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid transaction data' });
  }

  const validTypes = ['deposit', 'withdraw'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Type must be deposit or withdraw' });
  }

  db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newBalance = type === 'deposit' ? user.balance + amount : user.balance - amount;
    if (newBalance < 0) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const updateStmt = db.prepare('UPDATE users SET balance = ? WHERE id = ?');
    updateStmt.run(newBalance, userId, (updateErr) => {
      if (updateErr) return res.status(500).json({ error: updateErr.message });

      const insertStmt = db.prepare(
        'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)'
      );
      insertStmt.run(userId, type, amount, description || '', (insertErr) => {
        if (insertErr) return res.status(500).json({ error: insertErr.message });
        res.json({ userId, type, amount, description, balance: newBalance });
      });
      insertStmt.finalize();
    });
    updateStmt.finalize();
  });
});

app.get('/api/transactions/:userId', (req, res) => {
  const userId = req.params.userId;
  db.all(
    'SELECT id, type, amount, description, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
