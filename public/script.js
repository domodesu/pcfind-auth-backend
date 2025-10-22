const API_URL = ''; // Empty for same origin, or 'http://localhost:3000' for dev

// Check if user is logged in on dashboard
if (window.location.pathname.includes('dashboard')) {
  const username = localStorage.getItem('pcfind_username');
  if (!username) {
    window.location.href = 'index.html';
  } else {
    document.getElementById('username').textContent = username;
    document.getElementById('logoutBtn').addEventListener('click', () => {
      localStorage.removeItem('pcfind_username');
      window.location.href = 'index.html';
    });
  }
}

// Login form
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorMsg = document.getElementById('errorMessage');
    errorMsg.textContent = '';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('pcfind_username', data.user.username);
        window.location.href = 'dashboard.html';
      } else {
        errorMsg.textContent = data.error || 'Login failed';
      }
    } catch (error) {
      errorMsg.textContent = 'Network error. Please try again.';
    }
  });
}

// Register form
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorMsg = document.getElementById('errorMessage');
    errorMsg.textContent = '';

    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
      errorMsg.textContent = 'Passwords do not match';
      return;
    }

    if (password.length < 6) {
      errorMsg.textContent = 'Password must be at least 6 characters';
      return;
    }

    try {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Registration successful! Please log in.');
        window.location.href = 'index.html';
      } else {
        errorMsg.textContent = data.error || 'Registration failed';
      }
    } catch (error) {
      errorMsg.textContent = 'Network error. Please try again.';
    }
  });
}

