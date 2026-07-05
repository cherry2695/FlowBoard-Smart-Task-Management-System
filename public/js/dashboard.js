const API_BASE = '/api/tasks';
const tokenKey = 'flowboard_token';
let tasks = [];
let deleteTaskId = null;

function getToken() {
  return localStorage.getItem(tokenKey);
}

function redirectToLogin() {
  localStorage.removeItem(tokenKey);
  window.location.href = '/login';
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast align-items-center text-bg-${type === 'error' ? 'danger' : 'success'} border-0`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  container.appendChild(toast);
  const bsToast = new bootstrap.Toast(toast, { delay: 2500 });
  bsToast.show();
}

function setLoading(isLoading) {
  const loading = document.getElementById('tasksLoading');
  const container = document.getElementById('tasksContainer');
  if (loading) loading.style.display = isLoading ? 'block' : 'none';
  if (container) container.style.display = isLoading ? 'none' : '';
}

function resetTaskForm() {
  document.getElementById('taskForm').reset();
  document.getElementById('taskId').value = '';
  document.getElementById('taskModalTitle').textContent = 'Add Task';
}

function renderStats() {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === 'Completed').length;
  const pendingTasks = tasks.filter((task) => task.status === 'Pending').length;
  const highPriorityTasks = tasks.filter((task) => task.priority === 'High').length;

  document.getElementById('totalTasks').textContent = totalTasks;
  document.getElementById('completedTasks').textContent = completedTasks;
  document.getElementById('pendingTasks').textContent = pendingTasks;
  document.getElementById('highPriorityTasks').textContent = highPriorityTasks;
}

function getFilteredTasks() {
  const searchValue = document.getElementById('searchInput').value.toLowerCase();
  const filterValue = document.getElementById('filterSelect').value;

  return tasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchValue);
    const matchesFilter =
      filterValue === 'All' ||
      filterValue === task.status ||
      filterValue === task.priority;
    return matchesSearch && matchesFilter;
  });
}

function renderTasks() {
  const container = document.getElementById('tasksContainer');
  const visibleTasks = getFilteredTasks();
  container.innerHTML = '';

  if (!visibleTasks.length) {
    const emptyCol = document.createElement('div');
    emptyCol.className = 'col-12';
    emptyCol.innerHTML = '<div class="alert alert-light text-center">No tasks found.</div>';
    container.appendChild(emptyCol);
    return;
  }

  visibleTasks.forEach((task) => {
    const priorityClass = task.priority === 'High' ? 'badge-high' : task.priority === 'Medium' ? 'badge-medium' : 'badge-low';
    const normalizedStatus = task.status.toLowerCase().replace(/\s+/g, '-');
    const statusClass = `badge-status-${normalizedStatus}`;
    const statusBadgeClass = ['badge-status-pending', 'badge-status-in-progress', 'badge-status-on-hold', 'badge-status-review', 'badge-status-completed'].includes(statusClass)
      ? statusClass
      : 'badge-status-default';

    const col = document.createElement('div');
    col.className = 'col-12 col-md-6';

    const card = document.createElement('div');
    card.className = 'card task-card border-0 rounded-4 shadow-sm p-3 d-flex flex-column h-100';
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start mb-2">
        <h5 class="fw-semibold mb-0">${task.title}</h5>
        <span class="badge ${priorityClass} rounded-pill px-2 py-1">${task.priority}</span>
      </div>
      <p class="text-muted small mb-3">${task.description || 'No description provided.'}</p>
      <div class="d-flex justify-content-between text-muted small mb-3">
        <span><i class="bi bi-calendar-event me-1"></i>${new Date(task.dueDate).toLocaleDateString()}</span>
        <span class="badge ${statusBadgeClass}">${task.status}</span>
      </div>
      <div class="d-flex gap-2 flex-wrap mt-auto">
        <button class="btn btn-sm btn-success" data-action="toggle" data-id="${task._id}"><i class="bi bi-check2-circle me-1"></i>${task.status === 'Completed' ? 'Undo' : 'Complete'}</button>
        <button class="btn btn-sm btn-primary" data-action="edit" data-id="${task._id}"><i class="bi bi-pencil me-1"></i>Edit</button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${task._id}"><i class="bi bi-trash me-1"></i>Delete</button>
      </div>
    `;

    col.appendChild(card);
    container.appendChild(col);
  });
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
    if (response.status === 401) {
      redirectToLogin();
    }
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

async function loadProfile() {
  try {
    const data = await fetchWithAuth('/api/auth/profile');
    document.getElementById('userName').textContent = data.user?.fullName || 'User';
  } catch (error) {
    console.error(error);
  }
}

async function loadTasks() {
  setLoading(true);
  try {
    const data = await fetchWithAuth(API_BASE);
    tasks = Array.isArray(data) ? data : [];
    renderStats();
    renderTasks();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function createOrUpdateTask(event) {
  event.preventDefault();
  const taskId = document.getElementById('taskId').value;
  const title = document.getElementById('taskTitle').value.trim();
  const dueDate = document.getElementById('taskDueDate').value;

  if (!title || !dueDate) {
    showToast('Title and due date are required', 'error');
    return;
  }

  const payload = {
    title,
    description: document.getElementById('taskDescription').value.trim(),
    priority: document.getElementById('taskPriority').value,
    dueDate,
    status: document.getElementById('taskStatus').value,
  };

  try {
    if (taskId) {
      await fetchWithAuth(`${API_BASE}/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showToast('Task updated');
    } else {
      await fetchWithAuth(API_BASE, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Task added');
    }

    const modal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
    modal.hide();
    resetTaskForm();
    await loadTasks();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteTask() {
  if (!deleteTaskId) return;
  try {
    await fetchWithAuth(`${API_BASE}/${deleteTaskId}`, { method: 'DELETE' });
    showToast('Task deleted');
    const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
    modal.hide();
    deleteTaskId = null;
    await loadTasks();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function toggleTaskStatus(id) {
  try {
    await fetchWithAuth(`${API_BASE}/${id}/status`, { method: 'PATCH' });
    showToast('Task status updated');
    await loadTasks();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function openEditModal(taskId) {
  const task = tasks.find((item) => item._id === taskId);
  if (!task) return;

  document.getElementById('taskId').value = task._id;
  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDescription').value = task.description || '';
  document.getElementById('taskPriority').value = task.priority;
  document.getElementById('taskDueDate').value = task.dueDate.split('T')[0];
  document.getElementById('taskStatus').value = task.status;
  document.getElementById('taskModalTitle').textContent = 'Edit Task';

  const modal = new bootstrap.Modal(document.getElementById('taskModal'));
  modal.show();
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) {
    redirectToLogin();
    return;
  }

  document.getElementById('logoutButton').addEventListener('click', () => {
    localStorage.removeItem(tokenKey);
    window.location.href = '/';
  });

  document.getElementById('refreshButton').addEventListener('click', loadTasks);
  document.getElementById('searchInput').addEventListener('input', renderTasks);
  document.getElementById('filterSelect').addEventListener('change', renderTasks);
  document.getElementById('taskForm').addEventListener('submit', createOrUpdateTask);
  document.getElementById('taskModal').addEventListener('hidden.bs.modal', resetTaskForm);
  document.getElementById('confirmDeleteButton').addEventListener('click', deleteTask);

  document.getElementById('tasksContainer').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    const { action, id } = button.dataset;
    if (action === 'toggle') toggleTaskStatus(id);
    if (action === 'edit') openEditModal(id);
    if (action === 'delete') {
      deleteTaskId = id;
      const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
      modal.show();
    }
  });

  await loadProfile();
  await loadTasks();
});
