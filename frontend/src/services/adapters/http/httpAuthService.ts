import type { AuthService } from '../contracts';
import type {
  AuthSession,
  LoginCredentials,
  RegisterInput,
  VerifyOtpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '../../../types/auth';
import { apiClient } from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';

export class HttpAuthService implements AuthService {
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const session = await apiClient.post<AuthSession>(ENDPOINTS.LOGIN, credentials);
    apiClient.setToken(session.token);
    localStorage.setItem('bloodbridge_auth_token', session.token);
    return session;
  }

  async register(input: RegisterInput): Promise<AuthSession> {
    const session = await apiClient.post<AuthSession>(ENDPOINTS.REGISTER, input);
    apiClient.setToken(session.token);
    localStorage.setItem('bloodbridge_auth_token', session.token);
    return session;
  }

  async verifyOtp(input: VerifyOtpInput): Promise<boolean> {
    const result = await apiClient.post<{ verified: boolean }>(ENDPOINTS.VERIFY_OTP, input);
    return result.verified;
  }

  async requestOtp(phone: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>(ENDPOINTS.REQUEST_OTP, { phone });
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>(ENDPOINTS.FORGOT_PASSWORD, input);
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>(ENDPOINTS.RESET_PASSWORD, input);
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    const token = localStorage.getItem('bloodbridge_auth_token');
    if (!token) return null;

    try {
      apiClient.setToken(token);
      return await apiClient.get<AuthSession>(ENDPOINTS.ME);
    } catch {
      localStorage.removeItem('bloodbridge_auth_token');
      apiClient.setToken(null);
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post(ENDPOINTS.LOGOUT);
    } finally {
      localStorage.removeItem('bloodbridge_auth_token');
      apiClient.setToken(null);
    }
  }
}

export const httpAuthService = new HttpAuthService();
