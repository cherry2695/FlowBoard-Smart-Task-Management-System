const API_BASE = '/api/auth';
const tokenKey = 'flowboard_token';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setButtonLoading(button, isLoading, label) {
  if (!button) return;
  button.disabled = isLoading;
  button.innerHTML = isLoading
    ? '<span class="spinner-border spinner-border-sm me-2"></span>Processing...'
    : label;
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

function saveToken(token) {
  localStorage.setItem(tokenKey, token);
}

function getToken() {
  return localStorage.getItem(tokenKey);
}

function redirectIfAuthenticated() {
  if (getToken()) {
    window.location.href = '/dashboard';
  }
}

async function handleAuthRequest(url, body) {
  const button = document.querySelector('button[type="submit"]');
  const buttonLabel = button?.id === 'signupButton' ? 'Create Account' : 'Login';
  if (button) {
    setButtonLoading(button, true, buttonLabel);
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  } catch (error) {
    throw error;
  } finally {
    if (button) {
      setButtonLoading(button, false, buttonLabel);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  redirectIfAuthenticated();

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = document.getElementById('loginEmail').value.trim().toLowerCase();
      const password = document.getElementById('loginPassword').value.trim();

      if (!email || !password) {
        showToast('Please complete both fields', 'error');
        return;
      }

      if (!isValidEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
      }

      try {
        const data = await handleAuthRequest(`${API_BASE}/login`, { email, password });
        saveToken(data.token);
        showToast(data.message || 'Login successful');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 800);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fullName = document.getElementById('signupFullName').value.trim();
      const email = document.getElementById('signupEmail').value.trim().toLowerCase();
      const password = document.getElementById('signupPassword').value;
      const confirmPassword = document.getElementById('signupConfirmPassword').value;

      if (!fullName || !email || !password || !confirmPassword) {
        showToast('Please complete all signup fields', 'error');
        return;
      }

      if (!isValidEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
      }

      if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
      }

      if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
      }

      try {
        const data = await handleAuthRequest(`${API_BASE}/signup`, { fullName, email, password, confirmPassword });
        saveToken(data.token);
        showToast(data.message || 'Signup successful');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 800);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  const passwordToggles = document.querySelectorAll('.password-toggle');
  passwordToggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const targetId = toggle.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      toggle.innerHTML = `<i class="bi ${isPassword ? 'bi-eye-slash' : 'bi-eye'}"></i>`;
    });
  });
});
