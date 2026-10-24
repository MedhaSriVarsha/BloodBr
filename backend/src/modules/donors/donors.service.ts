import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/types.js';
import { hashPassword, generateRandomToken } from '../../shared/password.js';
import { emitToUser, emitAdminEvent } from '../../sockets/socket.server.js';
import type { DonorRegistrationPayload, UpdateDonorPayload, DonorListQueryParams } from './donors.schemas.js';

export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return '+1 (•••) •••-••••';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    const last4 = digits.slice(-4);
    return `+1 (${digits.slice(0, 3)}) •••-${last4}`;
  }
  return '•••-•••-' + (phone.slice(-4) || '••••');
}

export class DonorService {
  async listMyDonors(userId: string, params: DonorListQueryParams) {
    const { search, bloodGroup, status, state, district, page = 1, pageSize = 10, sortBy = 'createdAt', sortOrder = 'desc' } = params;

    // Retrieve referral codes owned by this user
    const myReferrals = await prisma.referral.findMany({
      where: { referrerUserId: userId, referredUserId: { not: null } },
      select: { referredUserId: true },
    });

    const referredUserIds = myReferrals.map((r) => r.referredUserId!).filter(Boolean);

    // Build filter query
    const where: any = {
      userId: { in: referredUserIds },
    };

    if (bloodGroup && bloodGroup !== 'ALL') {
      where.bloodGroup = bloodGroup;
    }

    if (state) {
      where.state = { contains: state, mode: 'insensitive' };
    }

    if (district) {
      where.district = { contains: district, mode: 'insensitive' };
    }

    if (status && status !== 'ALL') {
      if (status === 'active') {
        where.isAvailable = true;
      } else if (status === 'inactive') {
        where.isAvailable = false;
      }
    }

    if (search) {
      where.OR = [
        { city: { contains: search, mode: 'insensitive' } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const total = await prisma.donorProfile.count({ where });
    const skip = (page - 1) * pageSize;

    const profiles = await prisma.donorProfile.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { [sortBy]: sortOrder },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    const items = profiles.map((p) => ({
      id: p.id,
      fullName: p.user.fullName,
      bloodGroup: p.bloodGroup,
      city: p.city,
      state: p.state,
      district: p.district,
      status: p.user.status,
      availability: p.isAvailable ? 'available' : 'busy',
      lastDonation: p.lastDonationDate ? p.lastDonationDate.toISOString().split('T')[0] : 'Never',
      totalDonations: p.totalDonations,
      registeredAt: p.createdAt.toISOString(),
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async getDonorById(id: string, requestingUserId?: string, requestingUserRole?: string) {
    const profile = await prisma.donorProfile.findFirst({
      where: {
        OR: [{ id }, { userId: id }],
      },
      include: {
        user: {
          include: {
            consentRecords: true,
            receivedReferral: true,
          },
        },
      },
    });

    if (!profile) {
      throw new AppError('Donor profile not found', 404, 'NOT_FOUND');
    }

    // Determine authorization to view unmasked contact
    const isOwner = requestingUserId === profile.userId;
    const isAdmin = requestingUserRole === 'admin';
    const isReferrer = profile.user.receivedReferral?.referrerUserId === requestingUserId;

    // Check contact sharing consent
    const contactConsent = profile.user.consentRecords.find((c) => c.purpose === 'contact_sharing' && c.isGranted);

    // canAccessContact = true if admin, owner, or (referrer/coordinator with consent)
    const canAccessContact = isOwner || isAdmin || (isReferrer && !!contactConsent);

    const mobileNumber = canAccessContact
      ? profile.user.phone || '+1 (555) 000-0000'
      : maskPhoneNumber(profile.user.phone);

    const contactUnavailableReason = canAccessContact
      ? null
      : 'Direct contact details require verified coordinator authorization or explicit donor contact consent.';

    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.user.fullName,
      email: canAccessContact ? profile.user.email : '••••••@•••••.org',
      mobileNumber,
      bloodGroup: profile.bloodGroup,
      state: profile.state,
      district: profile.district,
      city: profile.city,
      donationWillingness: profile.donationWillingness,
      isAvailable: profile.isAvailable,
      lastDonationDate: profile.lastDonationDate?.toISOString() || null,
      totalDonations: profile.totalDonations,
      canAccessContact,
      contactUnavailableReason,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  async registerDonor(input: DonorRegistrationPayload) {
    const email = input.email.toLowerCase();

    // 1. Verify referral code exists
    const referral = await prisma.referral.findUnique({
      where: { referralCode: input.referralCode.toUpperCase() },
      include: { referrer: true },
    });

    if (!referral) {
      throw new AppError('Invalid or expired referral code.', 404, 'NOT_FOUND');
    }

    if (referral.status !== 'active') {
      throw new AppError('This referral code has been deactivated.', 400, 'REFERRAL_EXPIRED');
    }

    // Check existing account
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone: input.mobileNumber }],
      },
    });

    if (existing) {
      throw new AppError('A user with this email or phone number is already registered.', 409, 'CONFLICT', {
        email: 'Account already exists with this email address',
      });
    }

    // Default password for newly enrolled donors (can be updated later)
    const defaultPassword = 'Pass_' + generateRandomToken(6);
    const passwordHash = await hashPassword(defaultPassword);

    const userReferralCode = 'SAVIOR-' + generateRandomToken(4).toUpperCase();

    const created = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          fullName: input.fullName,
          email,
          phone: input.mobileNumber,
          passwordHash,
          role: 'donor',
          status: 'active',
          isEmailVerified: false,
        },
      });

      // Create donor profile
      const donorProfile = await tx.donorProfile.create({
        data: {
          userId: user.id,
          bloodGroup: input.bloodGroup,
          state: input.state,
          district: input.district,
          city: input.city,
          donationWillingness: input.donationWillingness,
          isAvailable: true,
          totalDonations: 0,
        },
      });

      // Create user's own shareable referral code
      await tx.referral.create({
        data: {
          referrerUserId: user.id,
          referralCode: userReferralCode,
          status: 'active',
        },
      });

      // Link incoming referral
      await tx.referral.update({
        where: { id: referral.id },
        data: {
          referredUserId: user.id,
          completedAt: new Date(),
        },
      });

      // Consent records
      await tx.consentRecord.createMany({
        data: [
          {
            userId: user.id,
            purpose: 'contact_sharing',
            policyVersion: 'v2.4-2026',
            isGranted: input.contactConsent,
          },
          {
            userId: user.id,
            purpose: 'terms_and_privacy',
            policyVersion: 'v2.4-2026',
            isGranted: input.termsAccepted,
          },
        ],
      });

      // Notify the referrer
      await tx.notification.create({
        data: {
          recipientId: referral.referrerUserId,
          notificationType: 'referral_success',
          title: 'New Donor Enrolled in Your Network!',
          message: `${input.fullName} (${input.bloodGroup}, ${input.city}) registered using your invitation code.`,
          relatedEntity: donorProfile.id,
        },
      });

      return { user, donorProfile };
    });

    // Real-time events
    emitToUser(referral.referrerUserId, 'donor:list:updated', {
      message: `${input.fullName} has joined your donor network.`,
    });
    emitToUser(referral.referrerUserId, 'referral:completed', {
      referralCode: input.referralCode,
      referredUserName: input.fullName,
    });
    emitAdminEvent('admin:dashboard:updated', { reason: 'New donor enrolled' });

    return {
      success: true,
      donorId: created.donorProfile.id,
      fullName: created.user.fullName,
      bloodGroup: created.donorProfile.bloodGroup,
      message: 'Donor successfully enrolled in the BloodBridge network.',
      assignedReferralCode: userReferralCode,
    };
  }

  async updateDonor(id: string, updates: UpdateDonorPayload, requestingUserId: string) {
    const profile = await prisma.donorProfile.findFirst({
      where: { OR: [{ id }, { userId: id }] },
      include: { user: true },
    });

    if (!profile) {
      throw new AppError('Donor profile not found', 404, 'NOT_FOUND');
    }

    if (profile.userId !== requestingUserId) {
      const user = await prisma.user.findUnique({ where: { id: requestingUserId } });
      if (user?.role !== 'admin') {
        throw new AppError('You do not have permission to update this profile.', 403, 'FORBIDDEN');
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (updates.fullName) {
        await tx.user.update({
          where: { id: profile.userId },
          data: { fullName: updates.fullName },
        });
      }

      return tx.donorProfile.update({
        where: { id: profile.id },
        data: {
          ...(updates.city && { city: updates.city }),
          ...(updates.district && { district: updates.district }),
          ...(updates.state && { state: updates.state }),
          ...(updates.bloodGroup && { bloodGroup: updates.bloodGroup }),
          ...(updates.donationWillingness && { donationWillingness: updates.donationWillingness }),
          ...(updates.isAvailable !== undefined && { isAvailable: updates.isAvailable }),
        },
        include: { user: true },
      });
    });

    emitToUser(profile.userId, 'donor:profile:updated', { donorId: updated.id });

    return this.getDonorById(updated.id, requestingUserId);
  }

  async reportIncorrectInfo(donorId: string, reason: string, reporterUserId?: string) {
    await prisma.supportTicket.create({
      data: {
        userId: reporterUserId || null,
        name: 'Donor Report',
        email: 'report@bloodbridge.internal',
        subject: `Discrepancy report for donor ID ${donorId}`,
        message: reason,
        category: 'medical',
        status: 'open',
      },
    });

    emitAdminEvent('admin:record:updated', { type: 'donor_report', donorId });

    return {
      success: true,
      message: 'Report logged successfully. Our operations team will review the information.',
    };
  }
}

export const donorService = new DonorService();
