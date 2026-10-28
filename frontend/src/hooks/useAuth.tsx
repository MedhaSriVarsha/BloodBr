import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type {
  User,
  AuthSession,
  LoginCredentials,
  RegisterInput,
  SignInCredentials,
  SignInResponse,
  SignUpInput,
  SignUpResponse,
  SignupReferralInput,
} from '../types/auth';
import { authService } from '../services';
import { appConfig } from '../constants/config';

interface AuthContextType {
  user: User | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  isDemo: boolean;
  signin: (credentials: SignInCredentials) => Promise<SignInResponse>;
  signup: (input: SignUpInput) => Promise<SignUpResponse>;
  signupWithReferral: (input: SignupReferralInput) => Promise<AuthSession>;
  verifyLoginOtp: (input: { email: string; code: string }) => Promise<AuthSession>;
  resendLoginOtp: (input: { email: string }) => Promise<{ success: boolean; message: string }>;
  verifyEmail: (input: { email: string; code: string }) => Promise<AuthSession>;
  resendVerification: (input: { email: string }) => Promise<{ success: boolean; message: string }>;
  login: (credentials: LoginCredentials) => Promise<AuthSession>;
  loginAsDemoUser: () => Promise<AuthSession>;
  loginAsDemoAdmin: () => Promise<AuthSession>;
  register: (input: RegisterInput) => Promise<AuthSession>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const current = await authService.getCurrentSession();
      setSession(current);
    } catch {
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const signin = async (credentials: SignInCredentials): Promise<SignInResponse> => {
    setIsLoading(true);
    try {
      return await authService.signin(credentials);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (input: SignUpInput): Promise<SignUpResponse> => {
    setIsLoading(true);
    try {
      return await authService.signup(input);
    } finally {
      setIsLoading(false);
    }
  };

  const signupWithReferral = async (input: SignupReferralInput): Promise<AuthSession> => {
    setIsLoading(true);
    try {
      const authResult = await authService.signupWithReferral(input);
      setSession(authResult);
      return authResult;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyLoginOtp = async (input: { email: string; code: string }): Promise<AuthSession> => {
    setIsLoading(true);
    try {
      const sessionResult = await authService.verifyLoginOtp(input);
      setSession(sessionResult);
      return sessionResult;
    } finally {
      setIsLoading(false);
    }
  };

  const resendLoginOtp = async (input: { email: string }): Promise<{ success: boolean; message: string }> => {
    return authService.resendLoginOtp(input);
  };

  const verifyEmail = async (input: { email: string; code: string }): Promise<AuthSession> => {
    setIsLoading(true);
    try {
      const sessionResult = await authService.verifyEmail(input);
      setSession(sessionResult);
      return sessionResult;
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerification = async (input: { email: string }): Promise<{ success: boolean; message: string }> => {
    return authService.resendVerification(input);
  };

  const login = async (credentials: LoginCredentials): Promise<AuthSession> => {
    setIsLoading(true);
    try {
      const authResult = await authService.login(credentials);
      setSession(authResult);
      return authResult;
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsDemoUser = async (): Promise<AuthSession> => {
    return login({ identifier: 'marcus.vance@example.org', password: 'Password123!' });
  };

  const loginAsDemoAdmin = async (): Promise<AuthSession> => {
    return login({ identifier: 'admin@bloodbridge.org', password: 'AdminPassword2026!' });
  };

  const register = async (input: RegisterInput): Promise<AuthSession> => {
    setIsLoading(true);
    try {
      const authResult = await authService.register(input);
      setSession(authResult);
      return authResult;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authService.logout();
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  const user = session?.user || null;
  const isAuthenticated = Boolean(user);
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated,
        isAdmin,
        isLoading,
        isDemo: appConfig.isDemo,
        signin,
        signup,
        signupWithReferral,
        verifyLoginOtp,
        resendLoginOtp,
        verifyEmail,
        resendVerification,
        login,
        loginAsDemoUser,
        loginAsDemoAdmin,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
