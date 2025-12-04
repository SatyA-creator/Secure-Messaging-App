import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { User, AuthState } from '@/types/messaging';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo users for showcase
const demoUsers: Record<string, { user: User; password: string }> = {
  'alice@secure.chat': {
    password: 'demo123',
    user: {
      id: '1',
      username: 'alice',
      email: 'alice@secure.chat',
      fullName: 'Alice Chen',
      publicKey: 'demo-public-key-alice',
      isOnline: true,
      lastSeen: new Date(),
    },
  },
  'bob@secure.chat': {
    password: 'demo123',
    user: {
      id: '2',
      username: 'bob',
      email: 'bob@secure.chat',
      fullName: 'Bob Wilson',
      publicKey: 'demo-public-key-bob',
      isOnline: true,
      lastSeen: new Date(),
    },
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: false,
  });

  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const demoUser = demoUsers[email.toLowerCase()];
    if (demoUser && demoUser.password === password) {
      setState({
        user: demoUser.user,
        isAuthenticated: true,
        isLoading: false,
        privateKey: 'demo-private-key',
      });
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
      throw new Error('Invalid credentials');
    }
  }, []);

  const register = useCallback(async (email: string, username: string, password: string, fullName: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newUser: User = {
      id: crypto.randomUUID(),
      username,
      email,
      fullName,
      publicKey: 'generated-public-key',
      isOnline: true,
      lastSeen: new Date(),
    };
    
    setState({
      user: newUser,
      isAuthenticated: true,
      isLoading: false,
      privateKey: 'generated-private-key',
    });
  }, []);

  const logout = useCallback(() => {
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
