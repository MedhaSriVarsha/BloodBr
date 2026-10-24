import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/shared/password.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding BloodBridge PostgreSQL database...');

  // 1. Organization Settings
  await prisma.organizationSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      name: 'BloodBridge',
      supportHelpline: '+1 (800) 555-BLOOD',
      supportEmail: 'support@bloodbridge.org',
      emergencyUrgentLine: '+1 (800) 999-URGENT',
      currentPolicyVersion: 'v2.4-2026',
      referralRewardPoints: 50,
      maintenanceMode: false,
    },
  });

  // 2. Administrator User (Dr. Evelyn Reed)
  const adminPasswordHash = await hashPassword('admin123');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@bloodbridge.org' },
    update: {
      fullName: 'Dr. Evelyn Reed',
      role: 'admin',
      status: 'active',
      isEmailVerified: true,
    },
    create: {
      fullName: 'Dr. Evelyn Reed',
      email: 'admin@bloodbridge.org',
      phone: '+1 800-555-0100',
      passwordHash: adminPasswordHash,
      role: 'admin',
      status: 'active',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  // 3. Primary Donor & Referrer (Marcus Vance)
  const donorPasswordHash = await hashPassword('password123');
  const marcusUser = await prisma.user.upsert({
    where: { email: 'marcus.vance@example.org' },
    update: {
      fullName: 'Marcus Vance',
      role: 'donor',
      status: 'active',
      isEmailVerified: true,
    },
    create: {
      fullName: 'Marcus Vance',
      email: 'marcus.vance@example.org',
      phone: '+1 555-019-2831',
      passwordHash: donorPasswordHash,
      role: 'donor',
      status: 'active',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  // Marcus's Donor Profile
  await prisma.donorProfile.upsert({
    where: { userId: marcusUser.id },
    update: {},
    create: {
      userId: marcusUser.id,
      bloodGroup: 'O+',
      city: 'Los Angeles',
      district: 'Los Angeles County',
      state: 'California',
      isAvailable: true,
      donationWillingness: 'regular',
      totalDonations: 12,
      lastDonationDate: new Date('2026-01-15T08:00:00Z'),
    },
  });

  // Marcus's Referral Code
  await prisma.referral.upsert({
    where: { referralCode: 'SAVIOR-MV2026' },
    update: { referrerUserId: marcusUser.id },
    create: {
      referrerUserId: marcusUser.id,
      referralCode: 'SAVIOR-MV2026',
      status: 'active',
    },
  });

  // 4. Sample Donors in Marcus's Referral Network
  const donorsData = [
    {
      fullName: 'Elena Rostova',
      email: 'elena.rostova@example.org',
      phone: '+1 555-892-4112',
      bloodGroup: 'B+',
      city: 'Santa Monica',
      district: 'Los Angeles County',
      state: 'California',
      totalDonations: 4,
      isAvailable: true,
      contactConsent: true,
    },
    {
      fullName: 'David Chen',
      email: 'david.chen@example.org',
      phone: '+1 555-481-9923',
      bloodGroup: 'O-',
      city: 'Pasadena',
      district: 'Los Angeles County',
      state: 'California',
      totalDonations: 8,
      isAvailable: true,
      contactConsent: false, // For privacy masking test
    },
    {
      fullName: 'Sarah Jenkins',
      email: 'sarah.jenkins@example.org',
      phone: '+1 555-312-7889',
      bloodGroup: 'A+',
      city: 'Irvine',
      district: 'Orange County',
      state: 'California',
      totalDonations: 2,
      isAvailable: true,
      contactConsent: true,
    },
    {
      fullName: 'Carlos Mendez',
      email: 'carlos.mendez@example.org',
      phone: '+1 555-671-2290',
      bloodGroup: 'AB+',
      city: 'Glendale',
      district: 'Los Angeles County',
      state: 'California',
      totalDonations: 5,
      isAvailable: false,
      contactConsent: true,
    },
    {
      fullName: 'Aisha Patel',
      email: 'aisha.patel@example.org',
      phone: '+1 555-783-4411',
      bloodGroup: 'A-',
      city: 'Torrance',
      district: 'Los Angeles County',
      state: 'California',
      totalDonations: 1,
      isAvailable: true,
      contactConsent: true,
    },
  ];

  for (const donor of donorsData) {
    const pwdHash = await hashPassword('password123');
    const user = await prisma.user.upsert({
      where: { email: donor.email },
      update: {},
      create: {
        fullName: donor.fullName,
        email: donor.email,
        phone: donor.phone,
        passwordHash: pwdHash,
        role: 'donor',
        status: 'active',
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.donorProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        bloodGroup: donor.bloodGroup,
        city: donor.city,
        district: donor.district,
        state: donor.state,
        isAvailable: donor.isAvailable,
        donationWillingness: 'regular',
        totalDonations: donor.totalDonations,
        lastDonationDate: new Date('2026-02-01T08:00:00Z'),
      },
    });

    // Record consent
    await prisma.consentRecord.createMany({
      data: [
        {
          userId: user.id,
          purpose: 'contact_sharing',
          policyVersion: 'v2.4-2026',
          isGranted: donor.contactConsent,
        },
        {
          userId: user.id,
          purpose: 'terms_and_privacy',
          policyVersion: 'v2.4-2026',
          isGranted: true,
        },
      ],
      skipDuplicates: true,
    });

    // Referral linkage
    const existingRef = await prisma.referral.findFirst({
      where: { referredUserId: user.id },
    });

    if (!existingRef) {
      await prisma.referral.create({
        data: {
          referrerUserId: marcusUser.id,
          referralCode: 'SAVIOR-MV2026-' + user.id.slice(0, 4),
          referredUserId: user.id,
          status: 'completed',
          completedAt: new Date(),
        },
      });
    }
  }

  // 5. Initial Notifications for Marcus
  await prisma.notification.createMany({
    data: [
      {
        recipientId: marcusUser.id,
        notificationType: 'referral_success',
        title: 'Elena Rostova Joined Your Network',
        message: 'Elena Rostova registered as a B+ blood donor using your invitation link.',
        isRead: false,
      },
      {
        recipientId: marcusUser.id,
        notificationType: 'system',
        title: 'Welcome to BloodBridge',
        message: 'Thank you for stepping up to be a savior. Share your referral code to expand the donor circle.',
        isRead: true,
      },
    ],
    skipDuplicates: true,
  });

  // 6. Audit Log Entry
  await prisma.auditLog.create({
    data: {
      actorId: adminUser.id,
      action: 'SYSTEM_SEED',
      entityType: 'System',
      details: { message: 'Database initialized with verified healthcare identities.' },
    },
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
