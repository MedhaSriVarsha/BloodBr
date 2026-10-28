import type { AuthService } from '../contracts';
import type {
  AuthSession,
  LoginCredentials,
  RegisterInput,
  VerifyOtpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  SignInCredentials,
  SignInResponse,
  SignUpInput,
  SignUpResponse,
  SignupReferralInput,
} from '../../../types/auth';
import { apiClient } from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';

export class HttpAuthService implements AuthService {
  async signin(credentials: SignInCredentials): Promise<SignInResponse> {
    return apiClient.post<SignInResponse>(ENDPOINTS.SIGNIN, credentials);
  }

  async signup(input: SignUpInput): Promise<SignUpResponse> {
    return apiClient.post<SignUpResponse>(ENDPOINTS.SIGNUP, input);
  }

  async signupWithReferral(input: SignupReferralInput): Promise<AuthSession> {
    const session = await apiClient.post<AuthSession>(ENDPOINTS.SIGNUP_REFERRAL, input);
    apiClient.setToken(session.token);
    localStorage.setItem('bloodbridge_auth_token', session.token);
    return session;
  }

  async verifyLoginOtp(input: { email: string; code: string }): Promise<AuthSession> {
    const session = await apiClient.post<AuthSession>(ENDPOINTS.VERIFY_LOGIN_OTP, input);
    apiClient.setToken(session.token);
    localStorage.setItem('bloodbridge_auth_token', session.token);
    return session;
  }

  async resendLoginOtp(input: { email: string }): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>(ENDPOINTS.RESEND_LOGIN_OTP, input);
  }

  async verifyEmail(input: { email: string; code: string }): Promise<AuthSession> {
    const session = await apiClient.post<AuthSession>(ENDPOINTS.VERIFY_EMAIL, input);
    apiClient.setToken(session.token);
    localStorage.setItem('bloodbridge_auth_token', session.token);
    return session;
  }

  async resendVerification(input: { email: string }): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>(ENDPOINTS.RESEND_VERIFICATION, input);
  }

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
    const payload = {
      ...input,
      otp: input.otp || input.code,
    };
    const result = await apiClient.post<{ verified: boolean }>(ENDPOINTS.VERIFY_OTP, payload);
    return result.verified;
  }

  async requestOtp(identifier: string): Promise<{ success: boolean; message: string }> {
    const isEmail = identifier.includes('@');
    const payload = isEmail ? { email: identifier } : { phone: identifier };
    return apiClient.post<{ success: boolean; message: string }>(ENDPOINTS.REQUEST_OTP, payload);
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<{ success: boolean; message: string }> {
    const email = input.email || (input.identifier?.includes('@') ? input.identifier : undefined);
    const payload = {
      ...input,
      ...(email ? { email } : {}),
    };
    return apiClient.post<{ success: boolean; message: string }>(ENDPOINTS.FORGOT_PASSWORD, payload);
  }

  async verifyResetToken(token: string): Promise<{ valid: boolean; email?: string; message: string }> {
    return apiClient.get<{ valid: boolean; email?: string; message: string }>(ENDPOINTS.VERIFY_RESET_TOKEN(token));
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ success: boolean; message: string }> {
    const token = input.token || input.code;
    return apiClient.post<{ success: boolean; message: string }>(ENDPOINTS.RESET_PASSWORD, {
      token,
      newPassword: input.newPassword,
    });
  }

  async changePassword(input: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>(ENDPOINTS.CHANGE_PASSWORD, input);
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
