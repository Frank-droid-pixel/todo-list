const nodemailer = require('nodemailer');
const cron = require('node-cron');
const db = require('../config/database');

// Configure email transporter
// Uses Gmail by default — update with your SMTP credentials in .env
let transporter = null;

function initEmailService() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';

  if (!user || !pass) {
    console.log('⚠️  Email service: No SMTP credentials set. Reminder emails will be logged only.');
    transporter = null;
    return;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  transporter.verify((err) => {
    if (err) {
      console.log('⚠️  Email service error:', err.message);
      transporter = null;
    } else {
      console.log('✅ Email service ready');
    }
  });
}

function buildReminderEmail(user, task, hoursUntilDeadline) {
  const deadline = new Date(task.deadline);
  const formattedDeadline = deadline.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long',
    day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const priorityColor = task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#22c55e';
  const timeLabel = hoursUntilDeadline <= 1 ? 'less than 1 hour' : `${Math.round(hoursUntilDeadline)} hours`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:40px 32px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">⏰</div>
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">Task Deadline Reminder</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">TaskMaster Pro Notification</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#94a3b8;margin:0 0 24px;font-size:16px;">Hi <strong style="color:#e2e8f0">${user.name}</strong>,</p>
      <p style="color:#94a3b8;margin:0 0 24px;font-size:15px;">
        You have a task due in <strong style="color:#f59e0b">${timeLabel}</strong>. Don't let it slip!
      </p>

      <!-- Task Card -->
      <div style="background:#0f172a;border-radius:12px;padding:24px;border-left:4px solid ${priorityColor};margin-bottom:24px;">
        <h2 style="color:#f1f5f9;margin:0 0 12px;font-size:18px;">${task.title}</h2>
        ${task.description ? `<p style="color:#64748b;margin:0 0 16px;font-size:14px;line-height:1.6;">${task.description}</p>` : ''}
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <span style="background:${priorityColor}22;color:${priorityColor};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;">${task.priority} priority</span>
          <span style="background:#334155;color:#94a3b8;padding:4px 12px;border-radius:20px;font-size:12px;">${task.category}</span>
          <span style="background:#334155;color:#94a3b8;padding:4px 12px;border-radius:20px;font-size:12px;">${task.status}</span>
        </div>
      </div>

      <!-- Deadline -->
      <div style="background:#1e3a5f;border-radius:8px;padding:16px;text-align:center;margin-bottom:24px;">
        <p style="color:#60a5fa;margin:0;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">DEADLINE</p>
        <p style="color:#e2e8f0;margin:0;font-size:18px;font-weight:600;">${formattedDeadline}</p>
      </div>

      <!-- CTA -->
      <div style="text-align:center;">
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard" 
           style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block;">
          View Task in Dashboard →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #334155;text-align:center;">
      <p style="color:#475569;margin:0;font-size:12px;">TaskMaster Pro · Automated Reminder · Do not reply to this email</p>
    </div>
  </div>
</body>
</html>`;

  return {
    from: `"TaskMaster Pro" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: `⏰ Reminder: "${task.title}" due in ${timeLabel}`,
    html
  };
}

async function sendReminderEmail(user, task, hoursUntilDeadline) {
  const emailOptions = buildReminderEmail(user, task, hoursUntilDeadline);

  if (!transporter) {
    // Log to console if no email configured
    console.log('\n📧 [EMAIL REMINDER - No SMTP configured, logging only]');
    console.log(`   To: ${user.email} (${user.name})`);
    console.log(`   Task: "${task.title}"`);
    console.log(`   Due in: ~${Math.round(hoursUntilDeadline)} hours`);
    console.log(`   Subject: ${emailOptions.subject}\n`);
    return { success: true, logged: true };
  }

  try {
    const info = await transporter.sendMail(emailOptions);
    console.log(`✅ Reminder email sent to ${user.email} for task "${task.title}"`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Failed to send email to ${user.email}:`, err.message);
    return { success: false, error: err.message };
  }
}

function checkAndSendReminders() {
  // Find tasks due within 24 hours and 1 hour, not yet reminded
  const query = `
    SELECT t.*, u.name as user_name, u.email as user_email
    FROM tasks t
    JOIN users u ON t.user_id = u.id
    WHERE t.status != 'completed'
      AND t.deadline IS NOT NULL
      AND t.reminder_sent = 0
      AND t.deadline > datetime('now')
      AND t.deadline <= datetime('now', '+24 hours')
  `;

  db.all(query, [], async (err, tasks) => {
    if (err) {
      console.error('Error checking reminders:', err);
      return;
    }

    for (const task of tasks) {
      const deadline = new Date(task.deadline);
      const now = new Date();
      const hoursUntilDeadline = (deadline - now) / (1000 * 60 * 60);

      const user = { name: task.user_name, email: task.user_email };
      await sendReminderEmail(user, task, hoursUntilDeadline);

      // Mark reminder as sent
      db.run('UPDATE tasks SET reminder_sent = 1 WHERE id = ?', [task.id]);
    }
  });
}

function startReminderCron() {
  // Check every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    console.log('🔍 Checking for task reminders...');
    checkAndSendReminders();
  });
  console.log('✅ Reminder cron job started (every 15 minutes)');
}

module.exports = { initEmailService, startReminderCron, sendReminderEmail };
