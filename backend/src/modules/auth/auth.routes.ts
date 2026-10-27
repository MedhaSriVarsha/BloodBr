import { Router } from 'express';
import { authController } from './auth.controller.js';
import { oauthController } from '../oauth/oauth.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authLimiter } from '../../middleware/rateLimiter.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  signupSchema,
  signinSchema,
  verifyLoginOtpSchema,
  resendLoginOtpSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  loginSchema,
  registerSchema,
  verifyOtpSchema,
  requestOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './auth.schemas.js';

const router = Router();

// BloodConnect Core Auth Endpoints
router.post('/signup', authLimiter, validate(signupSchema), authController.signup);
router.post('/verify-email', authLimiter, validate(verifyEmailSchema), authController.verifyEmail);
router.post('/resend-verification', authLimiter, validate(resendVerificationSchema), authController.resendVerification);
router.post('/signin', authLimiter, validate(signinSchema), authController.signin);
router.post('/verify-login-otp', authLimiter, validate(verifyLoginOtpSchema), authController.verifyLoginOtp);
router.post('/resend-login-otp', authLimiter, validate(resendLoginOtpSchema), authController.resendLoginOtp);

// Backwards-Compatible Aliases
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/verify-otp', authLimiter, validate(verifyOtpSchema), authController.verifyOtp);
router.post('/request-otp', authLimiter, validate(requestOtpSchema), authController.requestOtp);

// Password Recovery & Session
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.get('/verify-reset-token', authLimiter, authController.verifyResetToken);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post('/change-password', requireAuth, authLimiter, validate(changePasswordSchema), authController.changePassword);
router.get('/me', requireAuth, authController.getMe);
router.post('/logout', requireAuth, authController.logout);

// Google OAuth endpoints on /auth for unified access
router.get('/google', oauthController.getGoogleUrl);
router.get('/google/callback', oauthController.googleCallback);

export default router;
