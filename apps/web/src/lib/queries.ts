import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApproverGroupPayload, CreateDelegationInput, CreateRequestPayload, CreateWorkflowPayload } from '@proofloop/shared';
import type { Role, User } from '@/types';
import { adminApi, aiApi, delegationApi, groupApi, requestApi, workflowApi } from '@/lib/api';

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
  delegations: {
    mine: () => ['delegations', 'mine'] as const,
  },
  groups: {
    all: ['groups'] as const,
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
    mutationFn: async (input: CreateWorkflowPayload) => (await workflowApi.create(input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all }),
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRequestPayload) => (await requestApi.create(input)).data,
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
    mutationFn: async ({ action, comment, stepIndex }: { action: RequestAction; comment?: string; stepIndex?: number }) =>
      (await (action === 'approve' ? requestApi.approve : requestApi.reject)(id, { comment, stepIndex })).data,
    onSuccess: () => {
      // Refetch the request rather than using the response: what the viewer
      // can act on next (actionableSteps) is computed per viewer on reads.
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.detail(id) });
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

export function useMyDelegations() {
  return useQuery({
    queryKey: queryKeys.delegations.mine(),
    queryFn: async () => (await delegationApi.mine()).data,
    meta: { errorMessage: 'Failed to load delegations' },
  });
}

export function useCreateDelegation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDelegationInput) => (await delegationApi.create(input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.delegations.mine() }),
  });
}

export function useRevokeDelegation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await delegationApi.revoke(id)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.delegations.mine() }),
  });
}

export function useGroups() {
  return useQuery({
    queryKey: queryKeys.groups.all,
    queryFn: async () => (await groupApi.list()).data,
    meta: { errorMessage: 'Failed to load approver groups' },
  });
}

export function useSaveGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: ApproverGroupPayload }) =>
      (await (id ? groupApi.update(id, data) : groupApi.create(data))).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
      // Renames show up on workflow steps.
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => groupApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.groups.all }),
  });
}

export function useAiStatus() {
  return useQuery({
    queryKey: ['ai', 'status'] as const,
    queryFn: async () => (await aiApi.status()).data,
    staleTime: 5 * 60_000,
  });
}

export function useAiWorkflowDraft() {
  return useMutation({
    mutationFn: async (prompt: string) => (await aiApi.draftWorkflow(prompt)).data,
  });
}

export function useAiRequestReview(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await requestApi.aiReview(id)).data,
    // The advice is now part of the request's history.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.requests.detail(id) }),
  });
}
