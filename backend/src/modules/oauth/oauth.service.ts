import { prisma } from '../../config/database.js';
import { config } from '../../config/index.js';
import { signAccessToken } from '../../shared/jwt.js';
import { generateRandomToken } from '../../shared/password.js';
import { AppError } from '../../shared/types.js';
import { logger } from '../../shared/logger.js';

export class OAuthService {
  getGoogleAuthUrl(): string {
    if (!config.oauth.googleClientId) {
      // In development or when credentials are not yet populated, return instructions
      logger.warn('GOOGLE_CLIENT_ID not configured in backend .env. Refer to docs/SETUP.md for credentials setup.');
    }

    const state = generateRandomToken(16);
    const params = new URLSearchParams({
      client_id: config.oauth.googleClientId || 'GOOGLE_CLIENT_ID_PLACEHOLDER',
      redirect_uri: config.oauth.googleCallbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      state,
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleGoogleCallback(code: string, state?: string) {
    if (!config.oauth.googleClientId || !config.oauth.googleClientSecret) {
      throw new AppError(
        'Google OAuth credentials are not configured on the server. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
        500,
        'OAUTH_NOT_CONFIGURED'
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.oauth.googleClientId,
        client_secret: config.oauth.googleClientSecret,
        redirect_uri: config.oauth.googleCallbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData: any = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new AppError(tokenData.error_description || 'Failed to exchange authorization code with Google.', 400, 'OAUTH_FAILED');
    }

    // Fetch user profile using access token
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userInfo: any = await userInfoResponse.json();
    if (!userInfoResponse.ok || !userInfo.sub) {
      throw new AppError('Failed to fetch user profile claims from Google.', 400, 'OAUTH_FAILED');
    }

    const googleSub = userInfo.sub;
    const email = userInfo.email?.toLowerCase();
    const name = userInfo.name || 'Google Savior';
    const emailVerified = userInfo.email_verified === true;

    if (!email) {
      throw new AppError('Google account did not provide a valid email address.', 400, 'OAUTH_FAILED');
    }

    // Safely find or create account
    const session = await prisma.$transaction(async (tx) => {
      // 1. Check if OAuth account link already exists
      const existingOAuth = await tx.oAuthAccount.findUnique({
        where: {
          provider_providerSubjectId: {
            provider: 'google',
            providerSubjectId: googleSub,
          },
        },
        include: { user: true },
      });

      if (existingOAuth) {
        return existingOAuth.user;
      }

      // 2. Check if local user exists with this email
      let user = await tx.user.findUnique({ where: { email } });

      if (!user) {
        // Create new user
        user = await tx.user.create({
          data: {
            fullName: name,
            email,
            role: 'donor',
            status: 'active',
            isEmailVerified: emailVerified,
            emailVerifiedAt: emailVerified ? new Date() : null,
          },
        });

        // Create initial donor profile
        await tx.donorProfile.create({
          data: {
            userId: user.id,
            bloodGroup: 'O+',
            city: 'Unknown City',
            district: '',
            state: '',
            isAvailable: true,
          },
        });

        // Create referral code
        await tx.referral.create({
          data: {
            referrerUserId: user.id,
            referralCode: 'SAVIOR-' + generateRandomToken(4).toUpperCase(),
            status: 'active',
          },
        });
      }

      // 3. Link OAuth account
      await tx.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'google',
          providerSubjectId: googleSub,
        },
      });

      return user;
    });

    // Generate local JWT token
    const token = signAccessToken({
      userId: session.id,
      email: session.email,
      role: session.role,
    });

    return {
      user: {
        id: session.id,
        name: session.fullName,
        email: session.email,
        role: session.role,
        verified: session.isEmailVerified,
      },
      token,
      redirectUrl: `${config.frontendUrl}/auth/login?token=${token}`,
    };
  }
}

export const oauthService = new OAuthService();
