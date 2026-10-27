import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { errorHandler } from './middleware/error.middleware.js';
import { apiLimiter } from './middleware/rateLimiter.middleware.js';
import { logger } from './shared/logger.js';

// Route Modules
import authRoutes from './modules/auth/auth.routes.js';
import donorRoutes from './modules/donors/donors.routes.js';
import referralRoutes from './modules/referrals/referrals.routes.js';
import consentRoutes from './modules/consent/consent.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import supportRoutes from './modules/support/support.routes.js';
import oauthRoutes from './modules/oauth/oauth.routes.js';

export const app = express();

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS Configuration
app.use(cors({
  origin: [
    config.frontendUrl,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
}));

// Parsers
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Global Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.debug(`${req.method} ${req.originalUrl} ${res.statusCode} [${duration}ms]`);
  });
  next();
});

// Rate limiting on API routes
app.use('/api', apiLimiter);

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'BloodBridge / BloodConnect Full-Stack Platform API',
    version: '1.0.0-prod',
    database: 'Prisma ORM (Online)',
  });
});

// API v1 Routes
const v1Router = express.Router();
v1Router.use('/auth', authRoutes);
v1Router.use('/donors', donorRoutes);
v1Router.use('/referrals', referralRoutes);
v1Router.use('/consents', consentRoutes);
v1Router.use('/notifications', notificationRoutes);
v1Router.use('/profile', usersRoutes);
v1Router.use('/admin', adminRoutes);
v1Router.use('/support', supportRoutes);
v1Router.use('/oauth', oauthRoutes);

app.use('/api/v1', v1Router);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handler
app.use(errorHandler);
