export type UserRole = 'donor' | 'admin';

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  avatarUrl?: string;
  referralCode?: string;
  createdAt: string;
  isVerified: boolean;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: string;
}

export interface LoginCredentials {
  identifier?: string;
  email?: string;
  password?: string;
  otp?: string;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignInResponse {
  success: boolean;
  requiresOtp?: boolean;
  requiresEmailVerification?: boolean;
  email: string;
  expiresInSeconds?: number;
  resendCooldownSeconds?: number;
  message: string;
}

export interface SignUpInput {
  username: string;
  dateOfBirth: string;
  email: string;
  password: string;
  confirmPassword?: string;
  referralCode?: string;
  termsAccepted?: boolean;
}

export interface SignUpResponse {
  success: boolean;
  requiresVerification: boolean;
  email: string;
  username?: string;
  age?: number;
  isEligibleDonor?: boolean;
  message: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  termsAccepted: boolean;
  privacyAcknowledged: boolean;
  referralCodeUsed?: string;
}

export interface VerifyOtpInput {
  phone?: string;
  email?: string;
  code?: string;
  otp?: string;
  purpose?: string;
}

export interface ForgotPasswordInput {
  identifier?: string;
  email?: string;
}

export interface ResetPasswordInput {
  token?: string;
  identifier?: string;
  code?: string;
  newPassword: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mode: 'demo' | 'api';
}
