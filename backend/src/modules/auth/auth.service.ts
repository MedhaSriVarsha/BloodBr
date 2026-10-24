import { prisma } from '../../config/database.js';
import { hashPassword, verifyPassword, generateSecureOtp, hashToken, generateRandomToken } from '../../shared/password.js';
import { signAccessToken, signRefreshToken } from '../../shared/jwt.js';
import { emailService } from '../../shared/email.service.js';
import { AppError } from '../../shared/types.js';
import { config } from '../../config/index.js';
import { logger } from '../../shared/logger.js';
import { emitToUser, emitAdminEvent } from '../../sockets/socket.server.js';
import type { LoginInput, RegisterInput, VerifyOtpInput, ForgotPasswordInput, ResetPasswordInput } from './auth.schemas.js';

export class AuthService {
  async login(input: LoginInput) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input.identifier.toLowerCase() },
          { phone: input.identifier },
        ],
      },
      include: {
        donorProfile: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new AppError('Invalid email or password.', 401, 'UNAUTHORIZED');
    }

    if (user.status === 'suspended') {
      throw new AppError('Your account has been suspended. Please contact support.', 403, 'FORBIDDEN');
    }

    const isMatch = await verifyPassword(input.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401, 'UNAUTHORIZED');
    }

    // Generate JWT access and refresh tokens
    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshTokenString = generateRandomToken(40);
    const refreshTokenHash = hashToken(refreshTokenString);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        verified: user.isEmailVerified,
        createdAt: user.createdAt.toISOString(),
      },
      token: accessToken,
      refreshToken: refreshTokenString,
    };
  }

  async register(input: RegisterInput) {
    const email = input.email.toLowerCase();

    // Check duplicate
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(input.phone ? [{ phone: input.phone }] : []),
        ],
      },
    });

    if (existing) {
      throw new AppError(
        'An account with this email or phone number already exists.',
        409,
        'CONFLICT',
        { email: 'An account with this email already exists' }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Auto-generate a unique referral code for the new user
    const userReferralCode = 'SAVIOR-' + generateRandomToken(4).toUpperCase();

    // Use transaction for user creation and optional referral attribution
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create user
      const user = await tx.user.create({
        data: {
          fullName: input.fullName,
          email,
          phone: input.phone || null,
          passwordHash,
          role: input.role || 'donor',
          status: 'active',
          isEmailVerified: false,
        },
      });

      // 2. Create default referral code for this user
      await tx.referral.create({
        data: {
          referrerUserId: user.id,
          referralCode: userReferralCode,
          status: 'active',
        },
      });

      // 3. If registered via an existing referral code, link it
      if (input.referralCode) {
        const parentReferral = await tx.referral.findUnique({
          where: { referralCode: input.referralCode.toUpperCase() },
          include: { referrer: true },
        });

        if (parentReferral && parentReferral.referrerUserId !== user.id) {
          // Attribute referral
          await tx.referral.update({
            where: { id: parentReferral.id },
            data: {
              referredUserId: user.id,
              completedAt: new Date(),
            },
          });

          // Create notification for referrer
          await tx.notification.create({
            data: {
              recipientId: parentReferral.referrerUserId,
              notificationType: 'referral_success',
              title: 'New Donor Enrolled via Your Invitation!',
              message: `${user.fullName} joined BloodBridge using your referral link.`,
              relatedEntity: user.id,
            },
          });
        }
      }

      // 4. Default consent records
      await tx.consentRecord.createMany({
        data: [
          {
            userId: user.id,
            purpose: 'terms_and_privacy',
            policyVersion: 'v2.4-2026',
            isGranted: input.termsAccepted ?? true,
          },
          {
            userId: user.id,
            purpose: 'contact_sharing',
            policyVersion: 'v2.4-2026',
            isGranted: false, // strictly non-preselected per requirement
          },
        ],
      });

      return user;
    });

    // Send email OTP for verification
    await this.sendEmailOtp(email, 'registration', result.id);

    // Generate access token
    const accessToken = signAccessToken({
      userId: result.id,
      email: result.email,
      role: result.role,
    });

    return {
      user: {
        id: result.id,
        name: result.fullName,
        email: result.email,
        phone: result.phone,
        role: result.role,
        verified: result.isEmailVerified,
        createdAt: result.createdAt.toISOString(),
      },
      token: accessToken,
    };
  }

  async sendEmailOtp(email: string, purpose: string = 'registration', userId?: string) {
    const normalizedEmail = email.toLowerCase();

    // Check resend cooldown
    const recentChallenge = await prisma.emailOtpChallenge.findFirst({
      where: {
        email: normalizedEmail,
        purpose,
        createdAt: {
          gte: new Date(Date.now() - config.otp.resendCooldownSeconds * 1000),
        },
      },
    });

    if (recentChallenge) {
      throw new AppError(
        `Please wait ${config.otp.resendCooldownSeconds} seconds before requesting a new verification code.`,
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    const otpCode = generateSecureOtp();
    const hashedOtp = hashToken(otpCode);
    const expiresAt = new Date(Date.now() + config.otp.ttlSeconds * 1000);

    // Save OTP challenge to DB
    await prisma.emailOtpChallenge.create({
      data: {
        email: normalizedEmail,
        userId: userId || null,
        hashedOtp,
        purpose,
        expiresAt,
        attemptCount: 0,
      },
    });

    // Send email via Gmail SMTP
    const sent = await emailService.sendOtpEmail(normalizedEmail, otpCode, purpose);
    return {
      success: true,
      message: sent
        ? 'Verification code sent to your email address.'
        : 'Verification code generated. (Check email or local console in dev mode)',
    };
  }

  async verifyOtp(input: VerifyOtpInput): Promise<boolean> {
    const normalizedEmail = input.email ? input.email.toLowerCase() : '';
    const hashedOtp = hashToken(input.otp);

    // Find matching challenge
    const challenge = await prisma.emailOtpChallenge.findFirst({
      where: {
        email: normalizedEmail,
        purpose: input.purpose || 'registration',
        consumedAt: null,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new AppError('Invalid or expired verification code.', 400, 'VALIDATION_FAILED');
    }

    if (challenge.attemptCount >= config.otp.maxAttempts) {
      throw new AppError('Too many failed attempts. Please request a new code.', 429, 'RATE_LIMIT_EXCEEDED');
    }

    if (challenge.hashedOtp !== hashedOtp) {
      await prisma.emailOtpChallenge.update({
        where: { id: challenge.id },
        data: { attemptCount: { increment: 1 } },
      });
      throw new AppError('Incorrect verification code. Please check and try again.', 400, 'VALIDATION_FAILED');
    }

    // Atomically consume OTP and mark user as verified
    await prisma.$transaction(async (tx) => {
      await tx.emailOtpChallenge.update({
        where: { id: challenge.id },
        data: {
          consumedAt: new Date(),
          verifiedAt: new Date(),
        },
      });

      if (challenge.userId || normalizedEmail) {
        await tx.user.updateMany({
          where: challenge.userId ? { id: challenge.userId } : { email: normalizedEmail },
          data: {
            isEmailVerified: true,
            emailVerifiedAt: new Date(),
          },
        });
      }
    });

    return true;
  }

  async requestPasswordReset(input: ForgotPasswordInput) {
    const email = input.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    // Respond generically to prevent user enumeration
    if (!user) {
      return {
        success: true,
        message: 'If an account exists with that email, password reset instructions have been sent.',
      };
    }

    const resetToken = generateRandomToken(32);
    const tokenHash = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + config.passwordReset.ttlSeconds * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const resetLink = `${config.frontendUrl}/auth/reset-password?token=${resetToken}`;
    await emailService.sendPasswordResetEmail(user.email, resetLink);

    return {
      success: true,
      message: 'If an account exists with that email, password reset instructions have been sent.',
    };
  }

  async resetPassword(input: ResetPasswordInput) {
    const tokenHash = hashToken(input.token);

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.consumedAt || resetRecord.expiresAt < new Date()) {
      throw new AppError('Password reset link is invalid or has expired. Please request a new one.', 400, 'VALIDATION_FAILED');
    }

    const newHash = await hashPassword(input.newPassword);

    await prisma.$transaction(async (tx) => {
      // Consume token
      await tx.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { consumedAt: new Date() },
      });

      // Update password
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newHash },
      });

      // Revoke all existing refresh tokens for security
      await tx.refreshToken.updateMany({
        where: { userId: resetRecord.userId },
        data: { isRevoked: true },
      });
    });

    return {
      success: true,
      message: 'Your password has been successfully reset. You may now log in with your new password.',
    };
  }

  async getCurrentSession(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { donorProfile: true },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const token = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        verified: user.isEmailVerified,
        createdAt: user.createdAt.toISOString(),
      },
      token,
    };
  }

  async logout(userId: string) {
    await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }
}

export const authService = new AuthService();
