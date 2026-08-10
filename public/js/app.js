const API = {
  token: localStorage.getItem('turingtech_token'),

  async request(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      this.logout();
      throw new Error('Sesión expirada');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error en la petición');
    }

    return data;
  },

  setToken(token) {
    this.token = token;
    localStorage.setItem('turingtech_token', token);
  },

  logout() {
    this.token = null;
    localStorage.removeItem('turingtech_token');
    window.location.href = '/login.html';
  },

  isLoggedIn() {
    return !!this.token;
  },

  async getMe() {
    return this.request('/api/auth/me');
  },

  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  },

  async register(name, email, password, company, phone) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, company, phone }),
    });
  },

  async getDashboard() {
    return this.request('/api/credits/dashboard');
  },

  async requestCredits(projectDescription, requestedCredits) {
    return this.request('/api/credits/request', {
      method: 'POST',
      body: JSON.stringify({
        project_description: projectDescription,
        requested_credits: parseInt(requestedCredits),
      }),
    });
  },

  async getNotifications() {
    return this.request('/api/credits/notifications');
  },

  async markNotificationRead(id) {
    return this.request(`/api/credits/notifications/${id}/read`, {
      method: 'PUT',
    });
  },

  async getAdminUsers() {
    return this.request('/api/admin/users');
  },

  async getAdminUser(id) {
    return this.request(`/api/admin/users/${id}`);
  },

  async adjustUserCredits(id, amount, reason) {
    return this.request(`/api/admin/users/${id}/credits`, {
      method: 'POST',
      body: JSON.stringify({ amount: parseInt(amount), reason }),
    });
  },

  async getAdminRequests(status) {
    const query = status ? `?status=${status}` : '';
    return this.request(`/api/admin/requests${query}`);
  },

  async approveRequest(id, notes) {
    return this.request(`/api/admin/requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  async rejectRequest(id, notes) {
    return this.request(`/api/admin/requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  async getAdminConfig() {
    return this.request('/api/admin/config');
  },

  async updateAdminConfig(key, value) {
    return this.request('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    });
  },
};

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function showAlert(message, type = 'info', containerId = 'alert-container') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-xmark',
    warning: 'fa-circle-exclamation',
    info: 'fa-circle-info',
  };

  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${message}</span>`;
  container.appendChild(alert);

  setTimeout(() => {
    alert.style.opacity = '0';
    alert.style.transition = 'opacity 0.3s ease';
    setTimeout(() => alert.remove(), 300);
  }, 5000);
}

function getNotificationIcon(type) {
  const icons = {
    credit_approved: 'fa-circle-check',
    credit_rejected: 'fa-circle-xmark',
    credit_modified: ' fa-coins',
  };
  return icons[type] || 'fa-circle-info';
}

function getNotificationIconClass(type) {
  const classes = {
    credit_approved: 'success',
    credit_rejected: 'error',
    credit_modified: 'info',
  };
  return classes[type] || 'info';
}
