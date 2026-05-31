# ⚡ TaskMaster Pro

A complete full-stack Task Management System built with Node.js, Express, SQLite, and vanilla HTML/CSS/JS.

## Features

- **Authentication** — Register, login, logout with bcrypt password hashing & session management
- **Task CRUD** — Create, view, update, delete tasks with priority, status, category & deadlines
- **Email Reminders** — Automatic reminder emails sent 24 hours before task deadlines (via Nodemailer)
- **Countdown Timers** — Real-time per-task countdown timers updating every second
- **Alarm System** — Visual + audio alarm when a task deadline arrives, with browser notifications
- **Filtering** — Filter by status, priority, category, and search by keyword
- **Responsive UI** — Works on mobile and desktop

---

## Quick Start

### 1. Prerequisites
- **Node.js** v16 or higher — [Download](https://nodejs.org)
- **npm** (comes with Node.js)

### 2. Setup

```bash
# Clone or copy the project folder, then:
cd taskmaster

# Install all dependencies
npm install

# Start the server
npm start
```

Then open your browser at: **http://localhost:3000**

For development with auto-restart:
```bash
npm run dev
```

### 3. Email Reminders (Optional)

Edit the `.env` file with your email credentials:

```env
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
```

**For Gmail:** Go to Google Account → Security → 2-Step Verification → App Passwords → Generate a 16-character password.

> If no SMTP credentials are set, reminder emails are logged to the console instead.

---

## Project Structure

```
taskmaster/
├── server.js              # Entry point — Express app setup
├── package.json
├── .env                   # Environment variables (edit this!)
│
├── config/
│   └── database.js        # SQLite setup & table creation
│
├── routes/
│   ├── auth.js            # Register, login, logout endpoints
│   └── tasks.js           # Full CRUD task endpoints
│
├── middleware/
│   └── auth.js            # Session-based auth guard
│
├── emails/
│   └── reminderService.js # Nodemailer + cron reminder system
│
└── public/                # Static frontend files
    ├── login.html
    ├── register.html
    ├── dashboard.html
    ├── css/
    │   ├── auth.css
    │   └── dashboard.css
    └── js/
        ├── auth.js
        └── dashboard.js
```

---

## API Endpoints

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/register | Create new account |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Get current user |

### Tasks
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/tasks | Get all tasks (filterable) |
| GET | /api/tasks/stats | Get task statistics |
| GET | /api/tasks/:id | Get single task |
| POST | /api/tasks | Create task |
| PUT | /api/tasks/:id | Update task |
| PATCH | /api/tasks/:id/status | Quick status update |
| DELETE | /api/tasks/:id | Delete task |
| DELETE | /api/tasks | Delete all completed tasks |

---

## Keyboard Shortcuts

- `Ctrl/Cmd + N` — New task
- `Escape` — Close modal

---

## Deployment (Hosting)

### Railway / Render / Fly.io (Free tier)
1. Push to a GitHub repo
2. Connect repo to Railway/Render
3. Set environment variables in the dashboard
4. Deploy!

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3000
SESSION_SECRET=a-very-long-random-string-here
APP_URL=https://your-app.railway.app
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | SQLite3 (via sqlite3 package) |
| Sessions | express-session + connect-sqlite3 |
| Auth | bcryptjs (password hashing) |
| Email | Nodemailer |
| Scheduler | node-cron |
| Frontend | Vanilla HTML/CSS/JS |
| Fonts | Google Fonts (Syne + DM Sans + JetBrains Mono) |

---

## Test Accounts

Register any account on the registration page. Passwords are hashed with bcrypt (12 rounds).

---

Made for Software Construction course project.
