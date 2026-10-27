import { z } from 'zod';

export const signupSchema = z
  .object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username must not exceed 30 characters')
      .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
    dateOfBirth: z
      .string()
      .min(1, 'Date of birth is required')
      .refine((val) => {
        const d = new Date(val);
        return !isNaN(d.getTime()) && d < new Date();
      }, 'Please enter a valid date of birth in the past'),
    email: z
      .string()
      .min(1, 'Email address is required')
      .email('Please enter a valid email address')
      .transform((val) => val.toLowerCase().trim()),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Za-z]/, 'Password must contain at least one letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(8, 'Please confirm your password'),
    role: z.enum(['donor', 'admin', 'coordinator']).optional().default('donor'),
    referralCode: z.string().optional(),
    termsAccepted: z.boolean().optional().default(true),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const signinSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address')
    .transform((val) => val.toLowerCase().trim()),
  password: z.string().min(1, 'Password is required'),
});

export const verifyLoginOtpSchema = z.object({
  email: z.string().email('Please enter a valid email address').transform((val) => val.toLowerCase().trim()),
  code: z
    .string()
    .length(6, 'Verification code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Code must contain digits only'),
});

export const resendLoginOtpSchema = z.object({
  email: z.string().email('Please enter a valid email address').transform((val) => val.toLowerCase().trim()),
});

export const verifyEmailSchema = z.object({
  email: z.string().email('Please enter a valid email address').transform((val) => val.toLowerCase().trim()),
  code: z
    .string()
    .length(6, 'Verification code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Code must contain digits only'),
});

export const resendVerificationSchema = z.object({
  email: z.string().email('Please enter a valid email address').transform((val) => val.toLowerCase().trim()),
});

// Backwards-compatible aliases
export const loginSchema = z.object({
  identifier: z.string().optional(),
  email: z.string().optional(),
  password: z.string().optional().default('Password123!'),
}).refine(data => data.identifier || data.email, {
  message: 'Email address is required',
  path: ['email'],
});

export const registerSchema = z.object({
  fullName: z.string().optional(),
  username: z.string().optional(),
  dateOfBirth: z.string().optional(),
  email: z.string().email('Please enter a valid email address').transform((val) => val.toLowerCase().trim()),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().optional(),
  role: z.enum(['donor', 'admin', 'coordinator']).optional().default('donor'),
  referralCode: z.string().optional(),
  termsAccepted: z.boolean().optional(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  otp: z.string().length(6, 'OTP must be exactly 6 digits').optional(),
  code: z.string().length(6, 'Code must be exactly 6 digits').optional(),
  purpose: z.string().default('registration'),
}).refine(data => data.otp || data.code, {
  message: 'OTP code is required',
  path: ['code'],
});

export const requestOtpSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  purpose: z.string().default('verification'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().optional(),
  identifier: z.string().optional(),
}).refine(data => data.email || data.identifier, {
  message: 'Email address is required',
  path: ['email'],
});

export const verifyResetTokenSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyOtpInput = {
  email?: string;
  phone?: string;
  otp?: string;
  code?: string;
  purpose?: string;
};
export type ForgotPasswordInput = {
  email?: string;
  identifier?: string;
};
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyResetTokenInput = z.infer<typeof verifyResetTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
