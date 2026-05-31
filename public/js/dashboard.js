// ─── State ──────────────────────────────────────────────────────
let tasks = [];
let currentView = 'all';
let currentCategory = null;
let currentUser = null;
let countdownInterval = null;
let alarmIntervals = {};
let countdownHidden = false;
let isListView = false;
let deleteTargetId = null;

// ─── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadUser();
  loadTasks();
  setupEventListeners();
  startGlobalCountdown();
});

// ─── Load User ───────────────────────────────────────────────────
async function loadUser() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) { window.location.href = '/login'; return; }
    currentUser = await res.json();
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
  } catch {
    window.location.href = '/login';
  }
}

// ─── Load Tasks ──────────────────────────────────────────────────
async function loadTasks() {
  try {
    const params = new URLSearchParams();
    if (currentView !== 'all') params.set('status', currentView);
    if (currentCategory) params.set('category', currentCategory);

    const search = document.getElementById('searchInput').value.trim();
    if (search) params.set('search', search);

    const priority = document.getElementById('filterPriority').value;
    if (priority !== 'all') params.set('priority', priority);

    const res = await fetch(`/api/tasks?${params}`);
    const data = await res.json();
    tasks = data.tasks || [];

    renderTasks();
    loadStats();
    updateCountdownBanner();
  } catch (err) {
    showToast('error', '❌ Failed to load tasks');
  }
}

// ─── Load Stats ──────────────────────────────────────────────────
async function loadStats() {
  try {
    const res = await fetch('/api/tasks/stats');
    const s = await res.json();

    document.getElementById('stat-total').textContent = s.total || 0;
    document.getElementById('stat-high').textContent = s.highPriority || 0;
    document.getElementById('stat-overdue').textContent = s.overdue || 0;
    document.getElementById('stat-done').textContent = s.completed || 0;

    document.getElementById('badge-all').textContent = s.total || 0;
    document.getElementById('badge-pending').textContent = s.pending || 0;
    document.getElementById('badge-inprogress').textContent = s.inProgress || 0;
    document.getElementById('badge-completed').textContent = s.completed || 0;

    const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
    document.getElementById('progressPct').textContent = pct + '%';
    const circumference = 2 * Math.PI * 18;
    const offset = circumference - (pct / 100) * circumference;
    document.getElementById('ringFill').style.strokeDashoffset = offset;
  } catch {}
}

// ─── Render Tasks ────────────────────────────────────────────────
function renderTasks() {
  const container = document.getElementById('tasksContainer');
  const empty = document.getElementById('emptyState');

  if (tasks.length === 0) {
    empty.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(empty);
    document.getElementById('tasksCount').textContent = '0 tasks';
    return;
  }

  empty.style.display = 'none';
  document.getElementById('tasksCount').textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;

  container.innerHTML = tasks.map(task => renderTaskCard(task)).join('');

  // Start card countdowns
  tasks.forEach(task => {
    if (task.deadline && task.status !== 'completed') {
      startCardCountdown(task);
    }
  });
}

function renderTaskCard(task) {
  const isCompleted = task.status === 'completed';
  const now = new Date();
  const deadline = task.deadline ? new Date(task.deadline) : null;
  const isOverdue = deadline && deadline < now && !isCompleted;
  const isSoon = deadline && !isOverdue && (deadline - now) < 24 * 60 * 60 * 1000;

  const deadlineHtml = deadline ? `
    <span class="task-deadline ${isOverdue ? 'overdue' : isSoon ? 'soon' : ''}">
      ${isOverdue ? '⚠' : '📅'} ${formatDate(deadline)}
    </span>
  ` : '';

  const countdownHtml = deadline && !isCompleted ? `
    <div class="task-card-countdown">
      <span style="font-size:11px;color:var(--text3);">Time remaining</span>
      <span class="card-timer ${isOverdue ? 'urgent' : ''}" id="card-timer-${task.id}">
        ${isOverdue ? 'OVERDUE' : '...'}
      </span>
    </div>
  ` : '';

  return `
    <div class="task-card ${isCompleted ? 'completed-card' : ''} ${isOverdue ? 'overdue-card' : ''}" 
         data-id="${task.id}">
      <div class="task-card-top">
        <button class="task-checkbox ${isCompleted ? 'checked' : ''}" 
                onclick="toggleTaskStatus(${task.id}, '${task.status}')" 
                title="Toggle complete">
          ${isCompleted ? '✓' : ''}
        </button>
        <span class="task-title ${isCompleted ? 'done' : ''}">${escapeHtml(task.title)}</span>
        <div class="task-actions">
          <button class="task-action-btn" onclick="openEditModal(${task.id})" title="Edit">✏</button>
          <button class="task-action-btn delete" onclick="openDeleteModal(${task.id}, '${escapeHtml(task.title)}')" title="Delete">🗑</button>
        </div>
      </div>
      ${task.description ? `<div class="task-desc">${escapeHtml(task.description)}</div>` : ''}
      <div class="task-meta">
        <span class="badge badge-${task.priority}">${task.priority}</span>
        <span class="badge badge-${task.status}">${task.status}</span>
        <span class="badge badge-category">${task.category}</span>
        ${deadlineHtml}
      </div>
      ${countdownHtml}
    </div>
  `;
}

// ─── Card Countdown Timers ───────────────────────────────────────
function startCardCountdown(task) {
  if (alarmIntervals[task.id]) clearInterval(alarmIntervals[task.id]);

  const deadline = new Date(task.deadline);

  alarmIntervals[task.id] = setInterval(() => {
    const el = document.getElementById(`card-timer-${task.id}`);
    if (!el) {
      clearInterval(alarmIntervals[task.id]);
      return;
    }

    const now = new Date();
    const diff = deadline - now;

    if (diff <= 0) {
      el.textContent = 'OVERDUE';
      el.classList.add('urgent');
      // Trigger alarm for just-expired tasks
      if (diff > -60000 && diff <= 0) {
        triggerAlarm(task);
      }
    } else {
      el.textContent = formatDuration(diff);
      if (diff < 3600000) el.classList.add('urgent');
    }
  }, 1000);
}

// ─── Global Countdown Banner ─────────────────────────────────────
function startGlobalCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(updateCountdownBanner, 1000);
}

function updateCountdownBanner() {
  if (countdownHidden) return;

  const upcoming = tasks
    .filter(t => t.deadline && t.status !== 'completed' && new Date(t.deadline) > new Date())
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  const banner = document.getElementById('countdownBanner');

  if (upcoming.length === 0) {
    banner.style.display = 'none';
    return;
  }

  const next = upcoming[0];
  const diff = new Date(next.deadline) - new Date();

  banner.style.display = 'flex';
  document.getElementById('countdownTask').textContent = next.title;
  document.getElementById('countdownTimer').textContent = formatDuration(diff);

  // Pulse red when < 1 hour
  const timer = document.getElementById('countdownTimer');
  timer.style.color = diff < 3600000 ? 'var(--error)' : diff < 86400000 ? 'var(--warning)' : 'var(--info)';
}

// ─── Alarm System ────────────────────────────────────────────────
const triggeredAlarms = new Set();

function triggerAlarm(task) {
  if (triggeredAlarms.has(task.id)) return;
  triggeredAlarms.add(task.id);

  // Browser notification
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('⏰ Task Deadline!', {
      body: `"${task.title}" deadline has arrived!`,
      icon: '/favicon.ico'
    });
  }

  // Visual alarm overlay
  const overlay = document.createElement('div');
  overlay.className = 'alarm-overlay';
  overlay.innerHTML = `
    <div class="alarm-card">
      <div class="alarm-icon">⏰</div>
      <h2>Time's Up!</h2>
      <p>Your task deadline has arrived:</p>
      <div class="alarm-task-name">"${escapeHtml(task.title)}"</div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button class="btn-cancel" onclick="this.closest('.alarm-overlay').remove()">Dismiss</button>
        <button class="btn-save" onclick="markTaskDone(${task.id}); this.closest('.alarm-overlay').remove();">
          Mark Complete ✓
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Play audio beep
  playAlarmSound();

  // Auto-dismiss after 30s
  setTimeout(() => overlay.remove(), 30000);
}

function playAlarmSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const beepPattern = [0, 200, 400, 600];

    beepPattern.forEach(delay => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + delay / 1000);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay / 1000 + 0.15);
      osc.start(ctx.currentTime + delay / 1000);
      osc.stop(ctx.currentTime + delay / 1000 + 0.15);
    });
  } catch {}
}

// Request notification permissions
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// ─── Task CRUD ───────────────────────────────────────────────────
function openNewTaskModal() {
  document.getElementById('modalTitle').textContent = 'New Task';
  document.getElementById('taskForm').reset();
  document.getElementById('taskId').value = '';
  document.getElementById('taskStatus').value = 'pending';
  document.getElementById('taskPriority').value = 'medium';
  document.getElementById('taskCategory').value = 'general';
  openModal('modalOverlay');
}

async function openEditModal(id) {
  try {
    const res = await fetch(`/api/tasks/${id}`);
    const data = await res.json();
    const t = data.task;

    document.getElementById('modalTitle').textContent = 'Edit Task';
    document.getElementById('taskId').value = t.id;
    document.getElementById('taskTitle').value = t.title;
    document.getElementById('taskDesc').value = t.description || '';
    document.getElementById('taskPriority').value = t.priority;
    document.getElementById('taskStatus').value = t.status;
    document.getElementById('taskCategory').value = t.category;

    if (t.deadline) {
      const d = new Date(t.deadline);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      document.getElementById('taskDeadline').value = local.toISOString().slice(0, 16);
    } else {
      document.getElementById('taskDeadline').value = '';
    }

    openModal('modalOverlay');
  } catch {
    showToast('error', '❌ Failed to load task');
  }
}

document.getElementById('taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('taskId').value;
  const btn = document.getElementById('saveTaskBtn');
  const btnText = btn.querySelector('.btn-text');
  const btnLoader = btn.querySelector('.btn-loader');

  btn.disabled = true;
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');

  const payload = {
    title: document.getElementById('taskTitle').value,
    description: document.getElementById('taskDesc').value,
    priority: document.getElementById('taskPriority').value,
    status: document.getElementById('taskStatus').value,
    category: document.getElementById('taskCategory').value,
    deadline: document.getElementById('taskDeadline').value || null
  };

  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/tasks/${id}` : '/api/tasks';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.error) {
      showToast('error', '❌ ' + data.error);
    } else {
      showToast('success', id ? '✅ Task updated!' : '✅ Task created!');
      closeModal('modalOverlay');
      loadTasks();
    }
  } catch {
    showToast('error', '❌ Network error');
  } finally {
    btn.disabled = false;
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
  }
});

async function toggleTaskStatus(id, currentStatus) {
  const next = currentStatus === 'completed' ? 'pending' :
               currentStatus === 'pending' ? 'in-progress' : 'completed';

  try {
    await fetch(`/api/tasks/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next })
    });
    loadTasks();
    showToast('info', `Status → ${next}`);
  } catch {
    showToast('error', '❌ Update failed');
  }
}

async function markTaskDone(id) {
  try {
    await fetch(`/api/tasks/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' })
    });
    loadTasks();
    showToast('success', '✅ Task marked complete!');
  } catch {}
}

// ─── Delete ──────────────────────────────────────────────────────
function openDeleteModal(id, name) {
  deleteTargetId = id;
  document.getElementById('deleteTaskName').textContent = `"${name}"`;
  openModal('deleteOverlay');
}

function closeDeleteModal() {
  deleteTargetId = null;
  closeModal('deleteOverlay');
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
  if (!deleteTargetId) return;
  try {
    await fetch(`/api/tasks/${deleteTargetId}`, { method: 'DELETE' });
    showToast('success', '🗑 Task deleted');
    closeDeleteModal();
    loadTasks();
  } catch {
    showToast('error', '❌ Delete failed');
  }
});

document.getElementById('clearCompletedBtn').addEventListener('click', async () => {
  if (!confirm('Delete all completed tasks?')) return;
  try {
    const res = await fetch('/api/tasks', { method: 'DELETE' });
    const data = await res.json();
    showToast('success', `🧹 ${data.deleted} tasks cleared`);
    loadTasks();
  } catch {
    showToast('error', '❌ Failed to clear');
  }
});

// ─── Event Listeners ─────────────────────────────────────────────
function setupEventListeners() {
  // New task
  document.getElementById('newTaskBtn').addEventListener('click', openNewTaskModal);
  document.getElementById('cancelTaskBtn').addEventListener('click', () => closeModal('modalOverlay'));
  document.getElementById('modalClose').addEventListener('click', () => closeModal('modalOverlay'));

  // Sidebar nav
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      currentCategory = null;
      document.getElementById('pageTitle').textContent = btn.textContent.trim().replace(/\d+/g, '').trim();
      loadTasks();
      closeSidebar();
    });
  });

  document.querySelectorAll('.nav-item[data-category]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = 'all';
      currentCategory = btn.dataset.category;
      document.getElementById('pageTitle').textContent = btn.textContent.trim();
      loadTasks();
      closeSidebar();
    });
  });

  // Search & filter
  let searchTimer;
  document.getElementById('searchInput').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadTasks, 350);
  });

  document.getElementById('filterPriority').addEventListener('change', loadTasks);

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  });

  // Countdown dismiss
  document.getElementById('countdownClose').addEventListener('click', () => {
    countdownHidden = true;
    document.getElementById('countdownBanner').style.display = 'none';
  });

  // View toggle
  document.getElementById('viewGrid').addEventListener('click', () => {
    isListView = false;
    document.getElementById('tasksContainer').classList.remove('list-view');
    document.getElementById('viewGrid').classList.add('active');
    document.getElementById('viewList').classList.remove('active');
  });

  document.getElementById('viewList').addEventListener('click', () => {
    isListView = true;
    document.getElementById('tasksContainer').classList.add('list-view');
    document.getElementById('viewList').classList.add('active');
    document.getElementById('viewGrid').classList.remove('active');
    renderTasks();
  });

  // Mobile sidebar
  document.getElementById('menuToggle').addEventListener('click', openSidebar);
  document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

  // Close modal on overlay click
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('modalOverlay');
  });
  document.getElementById('deleteOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDeleteModal();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal('modalOverlay');
      closeDeleteModal();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      openNewTaskModal();
    }
  });
}

// ─── Modal Helpers ───────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// ─── Sidebar ─────────────────────────────────────────────────────
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ─── Toast Notifications ─────────────────────────────────────────
function showToast(type, message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── Utilities ───────────────────────────────────────────────────
function formatDate(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = d - now;

  if (diff < 0) return 'Overdue';
  if (diff < 86400000) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 7 * 86400000) {
    return d.toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(ms) {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);

  if (h >= 24) {
    const days = Math.floor(h / 24);
    const hrs = h % 24;
    return `${days}d ${hrs}h ${String(m).padStart(2,'0')}m`;
  }

  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
