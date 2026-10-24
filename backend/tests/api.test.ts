import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';

describe('BloodBridge Backend REST API Test Suite', () => {
  let adminToken: string;
  let donorToken: string;
  let registeredReferralCode: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // 1. Health check
  it('GET /health returns healthy status and PostgreSQL verification', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toContain('BloodBridge');
  });

  // 2. Authentication flows
  describe('Authentication System', () => {
    it('POST /api/v1/auth/login authenticates administrator successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'admin@bloodbridge.org',
          password: 'admin123',
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('admin');
      adminToken = res.body.token;
    });

    it('POST /api/v1/auth/login authenticates Marcus Vance (donor) successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'marcus.vance@example.org',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('donor');
      donorToken = res.body.token;
    });

    it('POST /api/v1/auth/login rejects incorrect passwords', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'admin@bloodbridge.org',
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/v1/auth/me returns authenticated session with valid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('marcus.vance@example.org');
    });

    it('GET /api/v1/auth/me rejects requests without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  // 3. Referral Validation & Enrolling
  describe('Referral System', () => {
    it('GET /api/v1/referrals/validate/:code confirms active referral code', async () => {
      const res = await request(app).get('/api/v1/referrals/validate/SAVIOR-MV2026');
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.referrerName).toBe('Marcus Vance');
    });

    it('GET /api/v1/referrals/validate/:code returns invalid for non-existent code', async () => {
      const res = await request(app).get('/api/v1/referrals/validate/SAVIOR-FAKE999');
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    it('GET /api/v1/referrals/stats returns referral metrics for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/referrals/stats')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.referralCode).toBe('SAVIOR-MV2026');
      expect(res.body.totalEnrolled).toBeGreaterThan(0);
      expect(res.body.rewardPoints).toBeGreaterThan(0);
    });
  });

  // 4. Donor Management & Contact Masking Privacy
  describe('Donor Registry & Contact Privacy Masking', () => {
    it('GET /api/v1/donors/my-referrals returns paginated network list for referrer', async () => {
      const res = await request(app)
        .get('/api/v1/donors/my-referrals?page=1&pageSize=10')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toBeInstanceOf(Array);
      expect(res.body.total).toBeGreaterThan(0);
    });

    it('GET /api/v1/donors/:id MASKS contact phone number when consent is not granted', async () => {
      // Find David Chen (contactConsent = false)
      const david = await prisma.user.findUnique({
        where: { email: 'david.chen@example.org' },
        include: { donorProfile: true },
      });

      expect(david).toBeDefined();

      // Marcus requests David Chen's details without direct contact clearance
      const res = await request(app)
        .get(`/api/v1/donors/${david!.donorProfile!.id}`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.canAccessContact).toBe(false);
      expect(res.body.mobileNumber).toContain('•••');
      expect(res.body.contactUnavailableReason).toBeDefined();
    });

    it('GET /api/v1/donors/:id reveals unmasked contact to administrator', async () => {
      const david = await prisma.user.findUnique({
        where: { email: 'david.chen@example.org' },
        include: { donorProfile: true },
      });

      const res = await request(app)
        .get(`/api/v1/donors/${david!.donorProfile!.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.canAccessContact).toBe(true);
      expect(res.body.mobileNumber).toBe(david!.phone);
    });

    it('POST /api/v1/donors/register successfully enrolls new donor via referral', async () => {
      const testEmail = `testdonor_${Date.now()}@example.org`;
      const testPhone = `+1 555-${Math.floor(100000 + Math.random() * 900000)}`;
      const res = await request(app)
        .post('/api/v1/donors/register')
        .send({
          referralCode: 'SAVIOR-MV2026',
          fullName: 'Test Automaton Donor',
          mobileNumber: testPhone,
          email: testEmail,
          bloodGroup: 'O+',
          state: 'California',
          district: 'Los Angeles County',
          city: 'Long Beach',
          donationWillingness: 'regular',
          contactConsent: true,
          privacyAcknowledged: true,
          termsAccepted: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.assignedReferralCode).toBeDefined();
    });
  });

  // 5. Administrator Governance & RBAC Protection
  describe('Administrator Operations & RBAC', () => {
    it('GET /api/v1/admin/metrics returns system metrics to administrator', async () => {
      const res = await request(app)
        .get('/api/v1/admin/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalUsers).toBeGreaterThan(0);
      expect(res.body.bloodGroupDistribution).toBeInstanceOf(Array);
    });

    it('GET /api/v1/admin/metrics REJECTS standard donor with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/metrics')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('GET /api/v1/admin/audit-logs returns immutable audit records', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toBeInstanceOf(Array);
      expect(res.body.total).toBeGreaterThan(0);
    });
  });

  // 6. User Profile & Consent
  describe('Profile & Consent Management', () => {
    it('GET /api/v1/profile returns user profile', async () => {
      const res = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Marcus Vance');
      expect(res.body.bloodGroup).toBe('O+');
    });

    it('GET /api/v1/consents/status returns current privacy preferences', async () => {
      const res = await request(app)
        .get('/api/v1/consents/status')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.emergencyBroadcastAllowed).toBeDefined();
    });
  });
});
