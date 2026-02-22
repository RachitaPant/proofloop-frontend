import axios from 'axios';
import { AuthResponse, Workflow, Request, Analytics } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

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

// Auth
export const authApi = {
  register: (data: { name: string; email: string; password: string; role: string }) =>
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
};

// Admin
export const adminApi = {
  getAnalytics: () => api.get<Analytics>('/admin/analytics'),
  getAllRequests: () => api.get<Request[]>('/admin/requests'),
};

export default api;
