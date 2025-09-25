import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AuthResponse, User } from '@/lib/types';

interface AuthState {
  user: Omit<User, 'password_hash'> | null;
  loading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
  });
  const router = useRouter();

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
      });

      if (!response.ok) {
        setAuthState({ user: null, loading: false });
        return;
      }

      const data: AuthResponse = await response.json();
      if (data.status === 'ok' && data.user) {
        setAuthState({ user: data.user, loading: false });
      } else {
        setAuthState({ user: null, loading: false });
      }
    } catch {
      setAuthState({ user: null, loading: false });
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setAuthState({ user: null, loading: false });
      router.push('/login');
    }
  }, [router]);

  const getAuthHeaders = useCallback((): Record<string, string> => ({
    'Content-Type': 'application/json',
  }), []);

  const authFetch = useCallback(
    (input: RequestInfo | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers as HeadersInit | undefined);

      if (!headers.has('Content-Type') && typeof init.body === 'string') {
        headers.set('Content-Type', 'application/json');
      }

      return fetch(input, {
        ...init,
        headers,
        credentials: 'include',
      });
    },
    [],
  );

  return {
    ...authState,
    logout,
    getAuthHeaders,
    authFetch,
    refresh: fetchSession,
    isAuthenticated: !!authState.user,
  };
}