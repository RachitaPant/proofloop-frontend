import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateRequestInput, CreateWorkflowInput } from '@proofloop/shared';
import type { Request, Role, User } from '@/types';
import { adminApi, requestApi, workflowApi } from '@/lib/api';

// Every server-state read and write in the app goes through these hooks, so
// cache keys and invalidation rules live in one place.

export const queryKeys = {
  requests: {
    all: ['requests'] as const,
    mine: () => ['requests', 'mine'] as const,
    pending: () => ['requests', 'pending'] as const,
    detail: (id: string) => ['requests', 'detail', id] as const,
  },
  workflows: {
    all: ['workflows'] as const,
    list: () => ['workflows', 'list'] as const,
    detail: (id: string) => ['workflows', 'detail', id] as const,
  },
  admin: {
    all: ['admin'] as const,
    analytics: () => ['admin', 'analytics'] as const,
    users: () => ['admin', 'users'] as const,
  },
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useMyRequests() {
  return useQuery({
    queryKey: queryKeys.requests.mine(),
    queryFn: async () => (await requestApi.getMyRequests()).data,
    meta: { errorMessage: 'Failed to load your requests' },
  });
}

export function usePendingRequests() {
  return useQuery({
    queryKey: queryKeys.requests.pending(),
    queryFn: async () => (await requestApi.getPendingRequests()).data,
    meta: { errorMessage: 'Failed to load pending approvals' },
  });
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: queryKeys.requests.detail(id),
    queryFn: async () => (await requestApi.getById(id)).data,
    meta: { errorMessage: 'Failed to load request' },
  });
}

export function useWorkflows() {
  return useQuery({
    queryKey: queryKeys.workflows.list(),
    queryFn: async () => (await workflowApi.getAll()).data,
    meta: { errorMessage: 'Failed to load workflows' },
  });
}

export function useWorkflow(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workflows.detail(id ?? ''),
    queryFn: async () => (await workflowApi.getById(id!)).data,
    enabled: !!id,
    meta: { errorMessage: 'Failed to load workflow' },
  });
}

export function useAnalytics() {
  return useQuery({
    queryKey: queryKeys.admin.analytics(),
    queryFn: async () => (await adminApi.getAnalytics()).data,
    meta: { errorMessage: 'Failed to load analytics' },
  });
}

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: async () => (await adminApi.getUsers()).data,
    meta: { errorMessage: 'Failed to load users' },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateWorkflowInput) => (await workflowApi.create(input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all }),
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRequestInput) => (await requestApi.create(input)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
  });
}

export type RequestAction = 'approve' | 'reject';

export function useRequestAction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, comment }: { action: RequestAction; comment?: string }) =>
      (await (action === 'approve' ? requestApi.approve(id, comment) : requestApi.reject(id, comment))).data,
    onSuccess: (updated: Request) => {
      // The response is the updated request: show it immediately, then refresh
      // the lists and stats it affects.
      queryClient.setQueryData(queryKeys.requests.detail(id), updated);
      queryClient.invalidateQueries({ queryKey: ['requests', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['requests', 'pending'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
  });
}

// On demand rather than a query: verification is something the user asks for.
export function useVerifyChain(id: string) {
  return useMutation({
    mutationFn: async () => (await requestApi.verify(id)).data,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) =>
      (await adminApi.updateUserRole(userId, role)).data,
    onSuccess: (updated: User) => {
      queryClient.setQueryData<User[]>(queryKeys.admin.users(), (users) =>
        users?.map((u) => (u.id === updated.id ? updated : u)),
      );
    },
  });
}
