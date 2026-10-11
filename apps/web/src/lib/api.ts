import axios, { type InternalAxiosRequestConfig } from 'axios';
import type {
  ApproverGroup,
  ApproverGroupPayload,
  CreateDelegationInput,
  CreateRequestPayload,
  CreateWorkflowPayload,
  Delegation,
  MyDelegations,
} from '@proofloop/shared';
import { AuthResponse, Workflow, Request, Analytics, User, Role, ChainVerification } from '@/types';

// Same-origin: next.config.js proxies /api/* to the API, and the session lives
// in httpOnly cookies the browser attaches automatically. No token is ever
// visible to page scripts.
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Silent refresh. The access cookie lives 15 minutes; on a 401 we rotate the
// refresh cookie once and replay the request. Concurrent 401s share a single
// refresh call. If refreshing fails we still replay once, because another tab
// may have just rotated the cookies; only a second 401 ends the session.
// ---------------------------------------------------------------------------

const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

let refreshInFlight: Promise<boolean> | null = null;
let onSessionExpired: () => void = () => {};

/** Called once a request is still unauthorised after a refresh attempt. */
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= api
    .post('/auth/refresh')
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const url = original?.url ?? '';
    if (error.response?.status !== 401 || !original || original._retried || NO_REFRESH.some((p) => url.startsWith(p))) {
      return Promise.reject(error);
    }

    original._retried = true;
    await refreshSession();
    try {
      return await api(original);
    } catch (retryError) {
      if (axios.isAxiosError(retryError) && retryError.response?.status === 401) onSessionExpired();
      throw retryError;
    }
  },
);

// Auth
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<AuthResponse>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<User>('/auth/me'),
};

// Workflows
export const workflowApi = {
  getAll: () => api.get<Workflow[]>('/workflows'),
  getById: (id: string) => api.get<Workflow>(`/workflows/${id}`),
  create: (data: CreateWorkflowPayload) => api.post<Workflow>('/workflows', data),
  delete: (id: string) => api.delete(`/workflows/${id}`),
};

// Requests
export const requestApi = {
  getMyRequests: () => api.get<Request[]>('/requests/mine'),
  getPendingRequests: () => api.get<Request[]>('/requests/pending'),
  getById: (id: string) => api.get<Request>(`/requests/${id}`),
  create: (data: CreateRequestPayload) => api.post<Request>('/requests', data),
  approve: (id: string, body: { comment?: string; stepIndex?: number }) =>
    api.post<Request>(`/requests/${id}/approve`, body),
  reject: (id: string, body: { comment?: string; stepIndex?: number }) =>
    api.post<Request>(`/requests/${id}/reject`, body),
  verify: (id: string) => api.get<ChainVerification>(`/requests/${id}/verify`),
};

// Delegations
export const delegationApi = {
  mine: () => api.get<MyDelegations>('/delegations'),
  create: (data: CreateDelegationInput) => api.post<Delegation>('/delegations', data),
  revoke: (id: string) => api.delete<Delegation>(`/delegations/${id}`),
};

// Approver groups (readable by everyone signed in; managed by admins)
export const groupApi = {
  list: () => api.get<ApproverGroup[]>('/groups'),
  create: (data: ApproverGroupPayload) => api.post<ApproverGroup>('/groups', data),
  update: (id: string, data: ApproverGroupPayload) => api.put<ApproverGroup>(`/groups/${id}`, data),
  delete: (id: string) => api.delete(`/groups/${id}`),
};

// Admin
export const adminApi = {
  getAnalytics: () => api.get<Analytics>('/admin/analytics'),
  getAllRequests: () => api.get<Request[]>('/admin/requests'),
  getUsers: () => api.get<User[]>('/admin/users'),
  updateUserRole: (id: string, role: Role) => api.patch<User>(`/admin/users/${id}/role`, { role }),
};

export default api;
