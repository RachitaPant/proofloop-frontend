import axios from 'axios';
import { AuthResponse, Workflow, Request, Analytics, User, Role, ChainVerification } from '@/types';

// Strip trailing slashes: "https://host/" + "/api" would produce "//api", which
// Vercel answers with a redirect that browsers refuse to follow on CORS preflights.
const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/+$/, '');

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 means the token is missing/expired/invalid (403 is a permission error
// and is left to the caller). Clear the session and send the user to login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthCall = error.config?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && !isAuthCall && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// Auth
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<AuthResponse>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data),
};

// Workflows
export const workflowApi = {
  getAll: () => api.get<Workflow[]>('/workflows'),
  getById: (id: string) => api.get<Workflow>(`/workflows/${id}`),
  create: (data: any) => api.post<Workflow>('/workflows', data),
  delete: (id: string) => api.delete(`/workflows/${id}`),
};

// Requests
export const requestApi = {
  getMyRequests: () => api.get<Request[]>('/requests/mine'),
  getPendingRequests: () => api.get<Request[]>('/requests/pending'),
  getById: (id: string) => api.get<Request>(`/requests/${id}`),
  create: (data: { title: string; description?: string; workflowId: string }) =>
    api.post<Request>('/requests', data),
  approve: (id: string, comment?: string) =>
    api.post<Request>(`/requests/${id}/approve`, { comment }),
  reject: (id: string, comment?: string) =>
    api.post<Request>(`/requests/${id}/reject`, { comment }),
  verify: (id: string) => api.get<ChainVerification>(`/requests/${id}/verify`),
};

// Admin
export const adminApi = {
  getAnalytics: () => api.get<Analytics>('/admin/analytics'),
  getAllRequests: () => api.get<Request[]>('/admin/requests'),
  getUsers: () => api.get<User[]>('/admin/users'),
  updateUserRole: (id: string, role: Role) => api.patch<User>(`/admin/users/${id}/role`, { role }),
};

export default api;
