import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/lib/types';

interface AuthState {
  user: Omit<User, 'password_hash'> | null;
  token: string | null;
  loading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
  });
  const router = useRouter();

  useEffect(() => {
    // Check for existing auth on mount
    const token = localStorage.getItem('token');
    const userString = localStorage.getItem('user');
    
    if (token && userString) {
      try {
        const user = JSON.parse(userString);
        setAuthState({
          user,
          token,
          loading: false,
        });
      } catch {
        // Invalid stored data, clear it
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setAuthState({
          user: null,
          token: null,
          loading: false,
        });
      }
    } else {
      setAuthState({
        user: null,
        token: null,
        loading: false,
      });
    }
  }, []);

  const login = useCallback((token: string, user: Omit<User, 'password_hash'>) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setAuthState({
      user,
      token,
      loading: false,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthState({
      user: null,
      token: null,
      loading: false,
    });
    router.push('/login');
  }, [router]);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (authState.token) {
      headers['Authorization'] = `Bearer ${authState.token}`;
    }
    
    return headers;
  }, [authState.token]);

  return {
    ...authState,
    login,
    logout,
    getAuthHeaders,
    isAuthenticated: !!authState.token,
  };
}