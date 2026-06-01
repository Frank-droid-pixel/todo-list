const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { redirectIfAuth } = require('../middleware/auth');

// GET /login
router.get('/login', redirectIfAuth, (req, res) => {
  res.sendFile('login.html', { root: './public' });
});

// GET /register
router.get('/register', redirectIfAuth, (req, res) => {
  res.sendFile('register.html', { root: './public' });
});

// POST /api/auth/register
router.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (row) return res.status(409).json({ error: 'Email already registered' });

    bcrypt.hash(password, 12, (err, hash) => {
      if (err) return res.status(500).json({ error: 'Error processing password' });

      db.run(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        [name.trim(), email.toLowerCase(), hash],
        function (err) {
          if (err) return res.status(500).json({ error: 'Error creating account' });

          req.session.userId = this.lastID;
          req.session.userName = name.trim();
          req.session.userEmail = email.toLowerCase();

          req.session.save((err) => {
            if (err) return res.status(500).json({ error: 'Session error' });
            res.json({ success: true, message: 'Account created successfully', redirect: '/dashboard' });
          });
        }
      );
    });
  });
});

// POST /api/auth/login
router.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    bcrypt.compare(password, user.password, (err, match) => {
      if (err) return res.status(500).json({ error: 'Authentication error' });
      if (!match) return res.status(401).json({ error: 'Invalid email or password' });

      req.session.userId = user.id;
      req.session.userName = user.name;
      req.session.userEmail = user.email;

      req.session.save((err) => {
        if (err) return res.status(500).json({ error: 'Session error' });
        res.json({ success: true, message: 'Login successful', redirect: '/dashboard' });
      });
    });
  });
});

// POST /api/auth/logout
router.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout error' });
    res.clearCookie('connect.sid');
    res.json({ success: true, redirect: '/login' });
  });
});

// GET /api/auth/me
router.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      id: req.session.userId,
      name: req.session.userName,
      email: req.session.userEmail
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

module.exports = router;