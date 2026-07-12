/// <reference types="vite/client" />
import axios from 'axios';


const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 600000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hanuji_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('hanuji_token');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (userId: string, name?: string) =>
    api.post('/api/auth/login', { userId, name, channel: 'web' }),
};

export const userApi = {
  getProfile: () => api.get('/api/users/profile'),
  updateProfile: (data: any) => api.put('/api/users/profile', data),
  getConversations: (limit = 50) => api.get(`/api/users/conversations?limit=${limit}`),
};

export const memoryApi = {
  getAll: () => api.get('/api/memory'),
  delete: (id: string) => api.delete(`/api/memory/${id}`),
};

export const analyticsApi = {
  getSummary: () => api.get('/api/analytics/summary'),
  getDaily: () => api.get('/api/analytics/daily'),
};

export const tasksApi = {
  getPending: () => api.get('/api/tasks?status=pending'),
  complete: (id: string) => api.patch(`/api/tasks/${id}/complete`),
};

export const briefingApi = {
  get: () => api.get('/api/briefing'),
};

export default api;
