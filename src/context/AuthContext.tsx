import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { User, AuthState } from '@/types/messaging';
import { ENV } from '@/config/env';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, fullName: string) => Promise<{ user: User; token: string } | undefined>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API Configuration
const API_BASE_URL = ENV.API_URL;

// API service functions
const apiService = {
  register: async (userData: { email: string; username: string; password: string; full_name: string }) => {
    console.log('Sending registration request to:', `${API_BASE_URL}/auth/register`);
    console.log('Request data:', { ...userData, password: '[REDACTED]' });
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      console.log('Registration response status:', response.status);
      console.log('Registration response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Registration error response:', errorText);
        
        let errorDetail = 'Registration failed';
        try {
          const errorJson = JSON.parse(errorText);
          errorDetail = errorJson.detail || errorDetail;
        } catch {
          errorDetail = errorText || errorDetail;
        }
        
        throw new Error(errorDetail);
      }
      
      const responseData = await response.json();
      console.log('Registration successful, response data:', responseData);
      return responseData;
    } catch (error) {
      console.error('Registration fetch error:', error);
      throw error;
    }
  },
  
  login: async (email: string, password: string) => {
    console.log('Sending login request to:', `${API_BASE_URL}/auth/login`);
    console.log('Login email:', email);
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      console.log('Login response status:', response.status);
      console.log('Login response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Login error response:', errorText);
        
        let errorDetail = 'Login failed';
        try {
          const errorJson = JSON.parse(errorText);
          errorDetail = errorJson.detail || errorDetail;
        } catch {
          errorDetail = errorText || errorDetail;
        }
        
        throw new Error(errorDetail);
      }
      
      const responseData = await response.json();
      console.log('Login successful, response data:', { ...responseData, access_token: '[REDACTED]' });
      return responseData;
    } catch (error) {
      console.error('Login fetch error:', error);
      throw error;
    }
  },
  
  getProfile: async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to get profile');
    }
    
    return response.json();
  },
};

// Demo users for testing (will be removed once API is fully integrated)
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

// Get stored auth token
const getStoredToken = (): string | null => {
  return localStorage.getItem('authToken');
};

// Store auth token
const storeToken = (token: string): void => {
  localStorage.setItem('authToken', token);
};

// Remove auth token
const removeToken = (): void => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true, // Start with loading to check existing auth
  });

  // Check for existing authentication on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const token = getStoredToken();
      if (token) {
        try {
          console.log('Found stored token, verifying...');
          const userProfile = await apiService.getProfile(token);
          
          const user: User = {
            id: userProfile.id,
            username: userProfile.username,
            email: userProfile.email,
            fullName: userProfile.full_name,
            publicKey: userProfile.public_key || 'api-public-key',
            isOnline: true,
            lastSeen: new Date(),
          };
          
          setState({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
          
          console.log('Auth restored from token');
        } catch (error) {
          console.log('Token verification failed:', error);
          removeToken();
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    initializeAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      console.log('Attempting login with API:', { email });
      
      // Try API login first
      const response = await apiService.login(email, password);
      
      console.log('API login successful:', response);
      
      // Store token
      storeToken(response.access_token);
      
      // Create user object from API response
      const user: User = {
        id: response.user.id,
        username: response.user.username,
        email: response.user.email,
        fullName: response.user.full_name,
        publicKey: response.user.public_key || 'api-public-key',
        isOnline: true,
        lastSeen: new Date(),
      };
      
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        privateKey: 'api-private-key',
      });
      
    } catch (apiError) {
      console.log('API login failed, trying demo users:', apiError);
      
      // Fallback to demo users for development
      const normalizedEmail = email.toLowerCase();
      const demoUser = demoUsers[normalizedEmail];
      
      if (demoUser && demoUser.password === password) {
        console.log('Demo user login successful');
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
    }
  }, []);

const register = useCallback(async (email: string, username: string, password: string, fullName: string) => {
  setState(prev => ({ ...prev, isLoading: true }));
  
  try {
    console.log('Attempting registration with API:', { email, username, fullName });
    
    // Call API to register user
    const response = await apiService.register({
      email,
      username,
      password,
      full_name: fullName,
    });
    
    console.log('API registration successful:', response);
    
    // ✅ Store the access token
    if (response.access_token) {
      storeToken(response.access_token);
    }
    
    // ✅ Create user object from API response (now has nested user object)
    const userData = response.user || response;
    const user: User = {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      fullName: userData.full_name,
      publicKey: userData.public_key || 'api-generated-public-key',
      isOnline: true,
      lastSeen: new Date(),
    };
    
    setState({
      user,
      isAuthenticated: true,
      isLoading: false,
      privateKey: 'api-generated-private-key',
    });
    
    // ✅ Return full response including token and user
    return {
      user: user,
      token: response.access_token,
      ...response
    };
    
  } catch (error) {
    console.error('Registration failed:', error);
    setState(prev => ({ ...prev, isLoading: false }));
    throw error;
  }
}, []);



  const logout = useCallback(() => {
    console.log('Logging out user');
    
    // Clear stored tokens and user data
    removeToken();
    
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
