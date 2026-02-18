import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { User, AuthState } from '@/types/messaging';
import { ENV } from '@/config/env';
import { cryptoService } from '@/lib/cryptoService';

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
  register: async (userData: { email: string; username: string; password: string; full_name: string; public_key?: string }) => {
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
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
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
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('Login request timed out after 30 seconds');
        throw new Error('Request timed out. Please check your connection and try again.');
      }
      console.error('Login fetch error:', error);
      throw error;
    }
  },
  
  getProfile: async (token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Profile fetch failed:', response.status, errorText);
        throw new Error(`Failed to get profile: ${response.status}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('getProfile error:', error);
      throw error;
    }
  },
};

/**
 * Ensure the user has an ECDH key pair, and upload to backend ONLY if the key
 * was just generated on this device. This prevents overwriting another device's
 * key on every page refresh, which would break cross-device decryption.
 */
async function ensureEncryptionKeys(token: string, forceUpload = false): Promise<string> {
  const publicKeyBase64 = await cryptoService.getPublicKeyBase64();
  const isNew = cryptoService.isKeyNewlyGenerated();

  // Only upload if the key is brand-new (first login on this device) or explicitly forced
  if (isNew || forceUpload) {
    console.log(isNew ? '🔑 New device — uploading fresh public key' : '🔑 Forced key upload');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/public-key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ public_key: publicKeyBase64 }),
      });
      if (!response.ok) {
        console.warn('Failed to upload public key to server:', response.status);
      }
    } catch (error) {
      console.warn('Could not upload public key (server may be offline):', error);
    }
  } else {
    console.log('🔑 Existing key — skipping re-upload to preserve cross-device consistency');
  }

  return publicKeyBase64;
}

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

// Store auth token and user data
const storeToken = (token: string, user?: User): void => {
  localStorage.setItem('authToken', token);
  if (user) {
    localStorage.setItem('userId', user.id);
    localStorage.setItem('userEmail', user.email);
    localStorage.setItem('username', user.username);
    localStorage.setItem('userRole', user.role || 'user');
  }
};

// Remove auth token and user data
const removeToken = (): void => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  localStorage.removeItem('userId');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('username');
  localStorage.removeItem('userRole');
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
          
          // Get role - prioritize localStorage over API (in case backend not deployed yet)
          const storedRole = localStorage.getItem('userRole');
          const roleToUse = storedRole || userProfile.role || 'user';
          
          console.log('✅ Token verified successfully');
          console.log('Role from API:', userProfile.role);
          console.log('Role from localStorage:', storedRole);
          console.log('Final role (localStorage priority):', roleToUse);
          
          // Ensure encryption keys exist (generate if needed, upload to backend)
          const publicKeyBase64 = await ensureEncryptionKeys(token);

          const user: User = {
            id: userProfile.id,
            username: userProfile.username,
            email: userProfile.email,
            fullName: userProfile.full_name,
            publicKey: publicKeyBase64,
            role: roleToUse,
            isOnline: true,
            lastSeen: new Date(),
          };

          setState({
            user,
            isAuthenticated: true,
            isLoading: false,
          });

          console.log('Auth restored from token');
          console.log('User:', user.username, 'Role:', user.role);
        } catch (error) {
          console.log('❌ Token verification failed:', error);
          console.log('Clearing invalid token and redirecting to login');
          removeToken();
          localStorage.removeItem('userRole');
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } else {
        console.log('No stored token found');
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
      
      // Store token first so ensureEncryptionKeys can use it
      const token = response.access_token;

      // Generate/load ECDH key pair. Force upload on explicit login
      // so the server always has the current device's key after a fresh login.
      const publicKeyBase64 = await ensureEncryptionKeys(token, true);

      // Create user object from API response with real public key
      const user: User = {
        id: response.user.id,
        username: response.user.username,
        email: response.user.email,
        fullName: response.user.full_name,
        publicKey: publicKeyBase64,
        isOnline: true,
        lastSeen: new Date(),
        role: response.user.role || 'user',
      };

      // Store token and user data
      storeToken(token, user);

      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
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

    // Generate ECDH key pair before registration so we can send the public key
    const publicKeyBase64 = await cryptoService.getPublicKeyBase64();

    // Call API to register user with real public key
    const response = await apiService.register({
      email,
      username,
      password,
      full_name: fullName,
      public_key: publicKeyBase64,
    });

    console.log('API registration successful');

    // Create user object from API response with real public key
    const userData = response.user || response;
    const user: User = {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      fullName: userData.full_name,
      publicKey: publicKeyBase64,
      isOnline: true,
      lastSeen: new Date(),
      role: userData.role || 'user',
    };

    // Store the access token and user data
    if (response.access_token) {
      storeToken(response.access_token, user);
    }

    setState({
      user,
      isAuthenticated: true,
      isLoading: false,
    });

    // Return full response including token and user
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

    // Clear crypto key cache (keys remain in IndexedDB for future login)
    cryptoService.clearCache();

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
