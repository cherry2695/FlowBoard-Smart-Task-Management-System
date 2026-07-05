/* ============================================================
   Flowboard — Analytics Dashboard
   All statistics computed client-side from /api/tasks
   ============================================================ */

const API_BASE    = '/api/tasks';
const tokenKey    = 'flowboard_token';

let allTasks      = [];
let filteredTasks = [];
let activeFilter  = 'week';
let customStart   = null;
let customEnd     = null;

// Chart instances (stored to destroy before re-render)
const chartInstances = {};

/* ── Auth Helpers ─────────────────────────────────────────── */
function getToken() { return localStorage.getItem(tokenKey); }

function redirectToLogin() {
  localStorage.removeItem(tokenKey);
  window.location.href = '/login';
}

async function fetchWithAuth(url, options = {}) {
  const token = getToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) redirectToLogin();
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

/* ── Date Filter Logic ────────────────────────────────────── */
function getDateRange(filter) {
  const now   = new Date();
  const start = new Date();

  switch (filter) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      return { start, end: now };

    case 'week': {
      const day = now.getDay(); // 0=Sun
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      return { start, end: now };
    }

    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return { start, end: now };

    case 'year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      return { start, end: now };

    case 'custom':
      if (customStart && customEnd) {
        return { start: new Date(customStart + 'T00:00:00'), end: new Date(customEnd + 'T23:59:59') };
      }
      return { start: new Date(0), end: now };

    default: // 'all'
      return { start: new Date(0), end: now };
  }
}

function applyFilter() {
  if (activeFilter === 'all') {
    filteredTasks = [...allTasks];
    return;
  }
  const { start, end } = getDateRange(activeFilter);
  filteredTasks = allTasks.filter(task => {
    // Use createdAt (from MongoDB timestamps) as the primary date for filtering
    const taskDate = new Date(task.createdAt || task.dueDate);
    return taskDate >= start && taskDate <= end;
  });
}

/* ── Statistics ───────────────────────────────────────────── */
function calcStats(tasks) {
  const total          = tasks.length;
  const completed      = tasks.filter(t => t.status === 'Completed').length;
  const pending        = tasks.filter(t => t.status === 'Pending').length;
  const highPriority   = tasks.filter(t => t.priority === 'High').length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const overdue        = tasks.filter(t => {
    if (t.status === 'Completed') return false;
    return new Date(t.dueDate) < new Date();
  }).length;
  const inProgress     = tasks.filter(t => t.status === 'In Progress').length;
  const highCompleted  = tasks.filter(t => t.priority === 'High' && t.status === 'Completed').length;
  const highTotal      = tasks.filter(t => t.priority === 'High').length;
  const highRate       = highTotal > 0 ? Math.round((highCompleted / highTotal) * 100) : 0;

  // Tasks completed this week
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const completedThisWeek = allTasks.filter(t =>
    t.status === 'Completed' && new Date(t.updatedAt || t.dueDate) >= weekStart
  ).length;

  return { total, completed, pending, highPriority, completionRate, overdue, inProgress, highRate, highTotal, highCompleted, completedThisWeek };
}

/* ── Render Stat Cards ────────────────────────────────────── */
function renderStatCards(stats) {
  setText('statTotal',        stats.total);
  setText('statCompleted',    stats.completed);
  setText('statPending',      stats.pending);
  setText('statHighPriority', stats.highPriority);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ── Chart Helpers ────────────────────────────────────────── */
function destroyChart(key) {
  if (chartInstances[key]) {
    chartInstances[key].destroy();
    delete chartInstances[key];
  }
}

const CHART_DEFAULTS = {
  font: { family: "'Inter', 'Segoe UI', sans-serif" },
};

/* ── 1. Status Doughnut Chart ─────────────────────────────── */
function renderStatusChart(tasks) {
  destroyChart('status');

  const completed  = tasks.filter(t => t.status === 'Completed').length;
  const pending    = tasks.filter(t => t.status === 'Pending').length;
  const inProgress = tasks.filter(t => t.status === 'In Progress').length;
  const onHold     = tasks.filter(t => t.status === 'On hold').length;
  const review     = tasks.filter(t => t.status === 'Review').length;

  const labels = ['Completed', 'Pending', 'In Progress', 'On Hold', 'Review'];
  const data   = [completed, pending, inProgress, onHold, review];
  const colors = ['#059669', '#f59e0b', '#0ea5e9', '#6b7280', '#6f42c1'];

  const ctx = document.getElementById('statusChart');
  if (!ctx) return;

  // Legend
  const legend = document.getElementById('statusLegend');
  if (legend) {
    legend.innerHTML = labels.map((l, i) => data[i] > 0
      ? `<span style="display:flex;align-items:center;gap:4px;">
           <span style="width:10px;height:10px;border-radius:50%;background:${colors[i]};display:inline-block;"></span>
           <span style="color:#6b7280;">${l} <strong style="color:#3b1e7a;">${data[i]}</strong></span>
         </span>`
      : '').join('');
  }

  chartInstances['status'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 3,
        borderColor: '#ffffff',
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw} task${ctx.raw !== 1 ? 's' : ''}`,
          },
          ...CHART_DEFAULTS,
        },
      },
    },
  });
}

/* ── 2. Priority Bar Chart ────────────────────────────────── */
function renderPriorityChart(tasks) {
  destroyChart('priority');

  const high   = tasks.filter(t => t.priority === 'High').length;
  const medium = tasks.filter(t => t.priority === 'Medium').length;
  const low    = tasks.filter(t => t.priority === 'Low').length;

  const ctx = document.getElementById('priorityChart');
  if (!ctx) return;

  chartInstances['priority'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['High', 'Medium', 'Low'],
      datasets: [{
        label: 'Tasks',
        data: [high, medium, low],
        backgroundColor: [
          'rgba(220,38,38,0.80)',
          'rgba(217,119,6,0.80)',
          'rgba(5,150,105,0.80)',
        ],
        borderRadius: 10,
        borderSkipped: false,
        hoverBackgroundColor: [
          'rgba(220,38,38,1)',
          'rgba(217,119,6,1)',
          'rgba(5,150,105,1)',
        ],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.raw} task${ctx.raw !== 1 ? 's' : ''}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: "'Inter', sans-serif", size: 12 }, color: '#6b7280' },
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            font: { family: "'Inter', sans-serif", size: 11 },
            color: '#9ca3af',
          },
          grid: { color: 'rgba(111,66,193,0.06)' },
          border: { dash: [4, 4] },
        },
      },
    },
  });
}

/* ── 3. Monthly Completion Line Chart ─────────────────────── */
function renderMonthlyChart(tasks) {
  destroyChart('monthly');

  // Build last 7 months of data
  const months      = [];
  const monthLabels = [];
  const now         = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
    monthLabels.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }));
  }

  // Count all completed tasks (from allTasks, not filtered, for meaningful history)
  const completedCounts = months.map(({ year, month }) =>
    allTasks.filter(t => {
      if (t.status !== 'Completed') return false;
      // Use updatedAt as completion proxy; fall back to dueDate
      const d = new Date(t.updatedAt || t.dueDate);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length
  );

  const createdCounts = months.map(({ year, month }) =>
    allTasks.filter(t => {
      const d = new Date(t.createdAt || t.dueDate);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length
  );

  const ctx = document.getElementById('monthlyChart');
  if (!ctx) return;

  chartInstances['monthly'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthLabels,
      datasets: [
        {
          label: 'Completed',
          data: completedCounts,
          borderColor: '#6f42c1',
          backgroundColor: 'rgba(111,66,193,0.10)',
          borderWidth: 2.5,
          pointBackgroundColor: '#6f42c1',
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Created',
          data: createdCounts,
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14,165,233,0.07)',
          borderWidth: 2,
          pointBackgroundColor: '#0ea5e9',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.4,
          fill: true,
          borderDash: [5, 3],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            borderRadius: 6,
            useBorderRadius: true,
            font: { family: "'Inter', sans-serif", size: 11 },
            color: '#6b7280',
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: "'Inter', sans-serif", size: 11 }, color: '#9ca3af' },
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            font: { family: "'Inter', sans-serif", size: 11 },
            color: '#9ca3af',
          },
          grid: { color: 'rgba(111,66,193,0.06)' },
          border: { dash: [4, 4] },
        },
      },
    },
  });
}

/* ── 4. Completion Rate Progress Ring ─────────────────────── */
function renderProgressRing(stats) {
  const rate       = stats.completionRate;
  const circumference = 2 * Math.PI * 80; // r=80
  const offset     = circumference - (rate / 100) * circumference;

  const fill = document.getElementById('progressRingFill');
  const pct  = document.getElementById('progressRingPct');
  const comp = document.getElementById('ringCompleted');
  const tot  = document.getElementById('ringTotal');

  if (fill) {
    fill.style.strokeDasharray  = circumference;
    // Animate from current to new
    requestAnimationFrame(() => {
      fill.style.strokeDashoffset = offset;
    });
  }
  if (pct)  pct.textContent  = `${rate}%`;
  if (comp) comp.textContent = stats.completed;
  if (tot)  tot.textContent  = stats.total;
}

/* ── 5. Recent Activity Table ─────────────────────────────── */
function renderRecentActivity(tasks) {
  const tbody = document.getElementById('recentActivityBody');
  if (!tbody) return;

  const completed = [...tasks]
    .filter(t => t.status === 'Completed')
    .sort((a, b) => new Date(b.updatedAt || b.dueDate) - new Date(a.updatedAt || a.dueDate))
    .slice(0, 8);

  if (!completed.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="analytics-empty">
      <i class="bi bi-inbox" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;opacity:0.4;"></i>
      No completed tasks yet.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = completed.map(t => {
    const due        = new Date(t.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const priClass   = t.priority.toLowerCase();
    return `<tr>
      <td style="font-weight:500;color:#1f2937;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(t.title)}</td>
      <td><span class="priority-badge ${priClass}">${t.priority}</span></td>
      <td style="white-space:nowrap;">${due}</td>
      <td><span style="background:rgba(5,150,105,0.1);color:#059669;font-size:0.7rem;font-weight:600;padding:0.2rem 0.6rem;border-radius:999px;">✓ Completed</span></td>
    </tr>`;
  }).join('');
}

/* ── 6. Upcoming Deadlines ────────────────────────────────── */
function renderUpcomingDeadlines(tasks) {
  const tbody = document.getElementById('upcomingDeadlinesBody');
  if (!tbody) return;

  const now      = new Date();
  const upcoming = [...allTasks] // always use allTasks for deadlines
    .filter(t => t.status !== 'Completed' && new Date(t.dueDate) >= now)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);

  const overdue = [...allTasks]
    .filter(t => t.status !== 'Completed' && new Date(t.dueDate) < now)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 3);

  const combined = [...overdue, ...upcoming].slice(0, 5);

  if (!combined.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="analytics-empty">
      <i class="bi bi-calendar-check" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;opacity:0.4;"></i>
      No upcoming tasks.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = combined.map(t => {
    const dueDate  = new Date(t.dueDate);
    const isOverdue = dueDate < now;
    const due      = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const priClass = t.priority.toLowerCase();
    const daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

    let dueBadge = '';
    if (isOverdue) {
      dueBadge = `<span class="overdue-badge ms-1"><i class="bi bi-exclamation-circle"></i> Overdue</span>`;
    } else if (daysLeft <= 3) {
      dueBadge = `<span style="font-size:0.68rem;color:#d97706;font-weight:600;margin-left:4px;">Due soon</span>`;
    }

    return `<tr>
      <td style="font-weight:500;color:#1f2937;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(t.title)}</td>
      <td style="white-space:nowrap;">${due}${dueBadge}</td>
      <td><span class="priority-badge ${priClass}">${t.priority}</span></td>
    </tr>`;
  }).join('');
}

/* ── 7. Productivity Insights ─────────────────────────────── */
function renderInsights(stats) {
  const container = document.getElementById('insightsContainer');
  if (!container) return;

  const insights = [];

  // Completion rate insight
  if (stats.completionRate >= 75) {
    insights.push({ icon: '🏆', text: `Excellent! Your completion rate is <strong>${stats.completionRate}%</strong>. Keep it up!` });
  } else if (stats.completionRate >= 50) {
    insights.push({ icon: '✅', text: `Good progress! Completion rate is <strong>${stats.completionRate}%</strong>.` });
  } else if (stats.total > 0) {
    insights.push({ icon: '💪', text: `Your completion rate is <strong>${stats.completionRate}%</strong>. Try clearing pending tasks!` });
  }

  // Tasks completed this week
  if (stats.completedThisWeek > 0) {
    insights.push({ icon: '🔥', text: `You completed <strong>${stats.completedThisWeek}</strong> task${stats.completedThisWeek !== 1 ? 's' : ''} this week.` });
  } else {
    insights.push({ icon: '⭐', text: `No tasks completed this week yet. Let's get started!` });
  }

  // Overdue tasks
  if (stats.overdue > 0) {
    insights.push({ icon: '⚠️', text: `You have <strong>${stats.overdue}</strong> overdue task${stats.overdue !== 1 ? 's' : ''}. Consider rescheduling.` });
  } else if (stats.total > 0) {
    insights.push({ icon: '🎯', text: `No overdue tasks! You're on top of your schedule.` });
  }

  // High priority completion
  if (stats.highTotal > 0) {
    insights.push({ icon: '⭐', text: `High priority completion rate is <strong>${stats.highRate}%</strong> (${stats.highCompleted}/${stats.highTotal} tasks).` });
  }

  // In Progress
  if (stats.inProgress > 0) {
    insights.push({ icon: '🚀', text: `<strong>${stats.inProgress}</strong> task${stats.inProgress !== 1 ? 's are' : ' is'} currently in progress.` });
  }

  // Pending
  if (stats.pending > 0) {
    insights.push({ icon: '📋', text: `<strong>${stats.pending}</strong> pending task${stats.pending !== 1 ? 's' : ''} waiting to be started.` });
  }

  if (!insights.length) {
    container.innerHTML = `<div class="analytics-empty">
      <i class="bi bi-emoji-smile" style="font-size:2rem;display:block;margin-bottom:0.5rem;opacity:0.4;"></i>
      Add some tasks to see insights!
    </div>`;
    return;
  }

  container.innerHTML = insights.map(ins =>
    `<div class="insight-chip">
      <span class="chip-icon">${ins.icon}</span>
      <span>${ins.text}</span>
    </div>`
  ).join('');
}

/* ── Master Render ────────────────────────────────────────── */
function renderAll() {
  applyFilter();
  const stats = calcStats(filteredTasks);

  renderStatCards(stats);
  renderStatusChart(filteredTasks);
  renderPriorityChart(filteredTasks);
  renderMonthlyChart(filteredTasks); // uses allTasks internally for history
  renderProgressRing(stats);
  renderRecentActivity(filteredTasks);
  renderUpcomingDeadlines(filteredTasks);
  renderInsights(stats);
}

/* ── Export CSV ───────────────────────────────────────────── */
function exportCSV() {
  const tasks = filteredTasks.length ? filteredTasks : allTasks;
  const headers = ['Title', 'Description', 'Priority', 'Status', 'Due Date', 'Created At'];
  const rows = tasks.map(t => [
    csvEsc(t.title),
    csvEsc(t.description || ''),
    t.priority,
    t.status,
    new Date(t.dueDate).toLocaleDateString(),
    new Date(t.createdAt).toLocaleDateString(),
  ]);

  const stats  = calcStats(tasks);
  const summary = [
    [],
    ['=== ANALYTICS SUMMARY ==='],
    ['Total Tasks', stats.total],
    ['Completed',   stats.completed],
    ['Pending',     stats.pending],
    ['High Priority', stats.highPriority],
    ['Completion Rate', `${stats.completionRate}%`],
    ['Overdue Tasks', stats.overdue],
    [],
  ];

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.join(',')),
    ...summary.map(r => r.join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `flowboard-analytics-${formatDateSlug()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/* ── Export PDF ───────────────────────────────────────────── */
async function exportPDF() {
  const btn = document.getElementById('exportPDF');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Generating…'; }

  try {
    const { jsPDF } = window.jspdf;
    const content   = document.getElementById('analyticsContent');

    const canvas = await html2canvas(content, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: '#f8f5ff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW   = pdf.internal.pageSize.getWidth();
    const pageH   = pdf.internal.pageSize.getHeight();
    const imgW    = pageW;
    const imgH    = (canvas.height * imgW) / canvas.width;

    let y = 0;
    while (y < imgH) {
      if (y > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, -y, imgW, imgH);
      y += pageH;
    }

    pdf.save(`flowboard-analytics-${formatDateSlug()}.pdf`);
  } catch (err) {
    console.error('PDF export failed:', err);
    alert('PDF export failed. Please try again.');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> Export PDF'; }
  }
}

/* ── Utility ──────────────────────────────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvEsc(str) {
  const s = String(str).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

function formatDateSlug() {
  return new Date().toISOString().slice(0, 10);
}

/* ── Initialisation ───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) { redirectToLogin(); return; }

  // Logout
  document.getElementById('logoutButton')?.addEventListener('click', () => {
    localStorage.removeItem(tokenKey);
    window.location.href = '/';
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;

      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const customRange = document.getElementById('customDateRange');
      if (customRange) {
        customRange.style.display = activeFilter === 'custom' ? 'flex' : 'none';
      }

      renderAll();
    });
  });

  // Custom date range inputs
  document.getElementById('customStart')?.addEventListener('change', e => {
    customStart = e.target.value;
    if (customStart && customEnd) renderAll();
  });

  document.getElementById('customEnd')?.addEventListener('change', e => {
    customEnd = e.target.value;
    if (customStart && customEnd) renderAll();
  });

  // Export
  document.getElementById('exportCSV')?.addEventListener('click', exportCSV);
  document.getElementById('exportPDF')?.addEventListener('click', exportPDF);

  // Load tasks
  const loading = document.getElementById('analyticsLoading');
  const content = document.getElementById('analyticsContent');

  try {
    const data = await fetchWithAuth(API_BASE);
    allTasks   = Array.isArray(data) ? data : [];

    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'block';

    renderAll();
  } catch (err) {
    console.error('Failed to load tasks:', err);
    if (loading) loading.innerHTML = `
      <i class="bi bi-exclamation-circle" style="font-size:2.5rem;color:#dc2626;"></i>
      <span style="color:#dc2626;">Failed to load analytics. Please refresh.</span>
    `;
  }
});
