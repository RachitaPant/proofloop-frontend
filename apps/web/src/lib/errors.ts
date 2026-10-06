import { isAxiosError } from 'axios';
import type { ApiError, ValidationErrors } from '@proofloop/shared';

/**
 * A human-readable message for a failed API call. The API returns either an
 * ApiError envelope ({ message, ... }) or, for 400 validation failures, a flat
 * { field: message } map; this handles both.
 */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (isAxiosError<Partial<ApiError> | ValidationErrors>(error)) {
    const body = error.response?.data;
    if (body && typeof body === 'object') {
      if (typeof body.message === 'string') return body.message;
      const firstFieldError = Object.values(body).find((v) => typeof v === 'string');
      if (firstFieldError) return firstFieldError;
    }
    if (!error.response) return 'Cannot reach the server. Check your connection and try again.';
  }
  return fallback;
}
