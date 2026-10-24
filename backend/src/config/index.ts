import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bloodbridge?schema=public',

  // Authentication & JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'bloodbridge-default-jwt-secret-do-not-use-in-production',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  // SMTP Settings
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || 'CPETORG1@gmail.com',
    pass: process.env.SMTP_PASS || 'pnnskptlxdkvmuhi',
    from: process.env.SMTP_FROM || 'CPETORG1@gmail.com',
    fromName: process.env.SMTP_FROM_NAME || 'BloodBridge',
  },

  // OTP Rules
  otp: {
    ttlSeconds: parseInt(process.env.EMAIL_OTP_TTL_SECONDS || '300', 10),
    maxAttempts: parseInt(process.env.EMAIL_OTP_MAX_ATTEMPTS || '5', 10),
    resendCooldownSeconds: parseInt(process.env.EMAIL_OTP_RESEND_COOLDOWN_SECONDS || '60', 10),
  },

  // Password Reset Rules
  passwordReset: {
    ttlSeconds: parseInt(process.env.PASSWORD_RESET_TTL_SECONDS || '900', 10),
  },

  // Google OAuth
  oauth: {
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/v1/auth/google/callback',
  },
};
