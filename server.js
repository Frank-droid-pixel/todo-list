require('dotenv').config();

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const SQLiteStore = require('connect-sqlite3')(session);

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const { initEmailService, startReminderCron } = require('./emails/reminderService');

const app = express();
const PORT = process.env.PORT || 3000;

// CRITICAL: Trust Render's reverse proxy
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Session store path
const sessionDir = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : __dirname;

// Session configuration
app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: sessionDir }),
  secret: process.env.SESSION_SECRET || 'taskmaster-super-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// Routes
app.use('/', authRoutes);
app.use('/', taskRoutes);

// Root redirect
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

// 404 handler
app.use((req, res) => {
  if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
    res.status(404).json({ error: 'Not found' });
  } else {
    res.redirect('/');
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n✅ TaskMaster Pro running on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
  initEmailService();
  startReminderCron();
});

module.exports = app;