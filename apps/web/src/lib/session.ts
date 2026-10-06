import type { AuthResponse } from '@/types';

// The signed-in session lives in localStorage ('token' + 'user'). This module
// is the only place that reads or writes it, and it notifies subscribers on
// every change so React (via useSyncExternalStore) and the API client stay in
// sync, including across browser tabs through the 'storage' event.

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const CHANGE_EVENT = 'proofloop:session';

function notify() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getToken(): string | null {
  return typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
}

/** Raw JSON string, so useSyncExternalStore gets a stable snapshot to compare. */
export function getUserSnapshot(): string | null {
  return localStorage.getItem(USER_KEY);
}

export function saveSession(auth: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, auth.token);
  localStorage.setItem(USER_KEY, JSON.stringify(auth));
  notify();
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notify();
}

export function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}
