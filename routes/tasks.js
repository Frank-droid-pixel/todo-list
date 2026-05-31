const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// GET /dashboard
router.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile('dashboard.html', { root: './public' });
});

// GET /api/tasks - Get all tasks for user
router.get('/api/tasks', requireAuth, (req, res) => {
  const { status, priority, category, search } = req.query;
  let query = 'SELECT * FROM tasks WHERE user_id = ?';
  const params = [req.session.userId];

  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }
  if (priority && priority !== 'all') {
    query += ' AND priority = ?';
    params.push(priority);
  }
  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }
  if (search) {
    query += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY CASE priority WHEN "high" THEN 1 WHEN "medium" THEN 2 WHEN "low" THEN 3 END, deadline ASC';

  db.all(query, params, (err, tasks) => {
    if (err) return res.status(500).json({ error: 'Error fetching tasks' });
    res.json({ tasks });
  });
});

// GET /api/tasks/stats
router.get('/api/tasks/stats', requireAuth, (req, res) => {
  const userId = req.session.userId;

  db.all(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN priority = 'high' AND status != 'completed' THEN 1 ELSE 0 END) as highPriority,
      SUM(CASE WHEN deadline < datetime('now') AND status != 'completed' THEN 1 ELSE 0 END) as overdue
    FROM tasks WHERE user_id = ?
  `, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error fetching stats' });
    res.json(rows[0]);
  });
});

// GET /api/tasks/:id
router.get('/api/tasks/:id', requireAuth, (req, res) => {
  db.get(
    'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
    [req.params.id, req.session.userId],
    (err, task) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json({ task });
    }
  );
});

// POST /api/tasks - Create task
router.post('/api/tasks', requireAuth, (req, res) => {
  const { title, description, priority, status, category, deadline } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Task title is required' });
  }

  const deadlineValue = deadline ? new Date(deadline).toISOString() : null;

  db.run(
    `INSERT INTO tasks (user_id, title, description, priority, status, category, deadline)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      req.session.userId,
      title.trim(),
      description?.trim() || '',
      priority || 'medium',
      status || 'pending',
      category || 'general',
      deadlineValue
    ],
    function (err) {
      if (err) return res.status(500).json({ error: 'Error creating task' });

      db.get('SELECT * FROM tasks WHERE id = ?', [this.lastID], (err, task) => {
        if (err) return res.status(500).json({ error: 'Error fetching created task' });
        res.status(201).json({ success: true, task, message: 'Task created successfully' });
      });
    }
  );
});

// PUT /api/tasks/:id - Update task
router.put('/api/tasks/:id', requireAuth, (req, res) => {
  const { title, description, priority, status, category, deadline } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Task title is required' });
  }

  const deadlineValue = deadline ? new Date(deadline).toISOString() : null;

  db.run(
    `UPDATE tasks SET 
      title = ?, description = ?, priority = ?, status = ?, 
      category = ?, deadline = ?, updated_at = CURRENT_TIMESTAMP,
      reminder_sent = CASE WHEN deadline != ? THEN 0 ELSE reminder_sent END
     WHERE id = ? AND user_id = ?`,
    [
      title.trim(),
      description?.trim() || '',
      priority || 'medium',
      status || 'pending',
      category || 'general',
      deadlineValue,
      deadlineValue,
      req.params.id,
      req.session.userId
    ],
    function (err) {
      if (err) return res.status(500).json({ error: 'Error updating task' });
      if (this.changes === 0) return res.status(404).json({ error: 'Task not found' });

      db.get('SELECT * FROM tasks WHERE id = ?', [req.params.id], (err, task) => {
        if (err) return res.status(500).json({ error: 'Error fetching updated task' });
        res.json({ success: true, task, message: 'Task updated successfully' });
      });
    }
  );
});

// PATCH /api/tasks/:id/status - Quick status update
router.patch('/api/tasks/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'in-progress', 'completed'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  db.run(
    'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
    [status, req.params.id, req.session.userId],
    function (err) {
      if (err) return res.status(500).json({ error: 'Error updating status' });
      if (this.changes === 0) return res.status(404).json({ error: 'Task not found' });
      res.json({ success: true, message: 'Status updated' });
    }
  );
});

// DELETE /api/tasks/:id
router.delete('/api/tasks/:id', requireAuth, (req, res) => {
  db.run(
    'DELETE FROM tasks WHERE id = ? AND user_id = ?',
    [req.params.id, req.session.userId],
    function (err) {
      if (err) return res.status(500).json({ error: 'Error deleting task' });
      if (this.changes === 0) return res.status(404).json({ error: 'Task not found' });
      res.json({ success: true, message: 'Task deleted successfully' });
    }
  );
});

// DELETE /api/tasks - Delete all completed tasks
router.delete('/api/tasks', requireAuth, (req, res) => {
  db.run(
    "DELETE FROM tasks WHERE user_id = ? AND status = 'completed'",
    [req.session.userId],
    function (err) {
      if (err) return res.status(500).json({ error: 'Error deleting tasks' });
      res.json({ success: true, deleted: this.changes, message: `${this.changes} completed tasks deleted` });
    }
  );
});

module.exports = router;
