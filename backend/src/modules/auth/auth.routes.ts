import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authLimiter } from '../../middleware/rateLimiter.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  loginSchema,
  registerSchema,
  verifyOtpSchema,
  requestOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schemas.js';

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/verify-otp', authLimiter, validate(verifyOtpSchema), authController.verifyOtp);
router.post('/request-otp', authLimiter, validate(requestOtpSchema), authController.requestOtp);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.get('/me', requireAuth, authController.getMe);
router.post('/logout', requireAuth, authController.logout);

export default router;
