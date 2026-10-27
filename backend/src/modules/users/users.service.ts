import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/types.js';

export class UsersService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        donorProfile: true,
        consentRecords: true,
      },
    });

    if (!user) {
      throw new AppError('User profile not found', 404, 'NOT_FOUND');
    }

    return {
      id: user.id,
      name: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      verified: user.isEmailVerified,
      createdAt: user.createdAt.toISOString(),
      bloodGroup: user.donorProfile?.bloodGroup || 'O+',
      city: user.donorProfile?.city || 'Unknown City',
      state: user.donorProfile?.state || '',
      district: user.donorProfile?.district || '',
      donationWillingness: user.donorProfile?.donationWillingness || 'regular',
      isAvailable: user.donorProfile?.isAvailable ?? true,
      totalDonations: user.donorProfile?.totalDonations || 0,
      lastDonationDate: user.donorProfile?.lastDonationDate?.toISOString() || null,
    };
  }

  async updateProfile(userId: string, input: any) {
    await prisma.$transaction(async (tx) => {
      if (input.fullName || input.name) {
        await tx.user.update({
          where: { id: userId },
          data: { fullName: input.fullName || input.name },
        });
      }

      const city = input.city || input.location?.city;
      const state = input.state || input.location?.state;
      const district = input.district || input.location?.district;
      const willingness = input.willingness || input.donationWillingness;
      const isAvailable = input.emergencyAvailability !== undefined ? input.emergencyAvailability : input.isAvailable;

      if (city || state || district || input.bloodGroup || willingness || isAvailable !== undefined) {
        await tx.donorProfile.upsert({
          where: { userId },
          create: {
            userId,
            bloodGroup: input.bloodGroup || 'O+',
            city: city || 'Unknown City',
            state: state || '',
            district: district || '',
            donationWillingness: willingness || 'regular',
            isAvailable: isAvailable !== undefined ? isAvailable : true,
          },
          update: {
            ...(city && { city }),
            ...(state && { state }),
            ...(district && { district }),
            ...(input.bloodGroup && { bloodGroup: input.bloodGroup }),
            ...(willingness && { donationWillingness: willingness }),
            ...(isAvailable !== undefined && { isAvailable }),
          },
        });
      }

      if (input.contactSharingConsent !== undefined) {
        await tx.consentRecord.create({
          data: {
            userId,
            purpose: 'contact_sharing',
            policyVersion: 'v2.4-2026',
            isGranted: input.contactSharingConsent,
            revokedAt: input.contactSharingConsent ? null : new Date(),
          },
        });
      }
    });

    return this.getProfile(userId);
  }

  async exportData(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        donorProfile: true,
        consentRecords: true,
        createdReferrals: true,
        notifications: true,
      },
    });

    return {
      downloadUrl: '#',
      generatedAt: new Date().toISOString(),
      data: user,
    };
  }

  async requestAccountDeletion(userId: string, reason: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'suspended' },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'ACCOUNT_DELETION_REQUESTED',
        entityType: 'User',
        entityId: userId,
        details: JSON.stringify({ reason }),
      },
    });

    return {
      success: true,
      message: 'Account deletion request processed. Your account is now deactivated.',
    };
  }
}

export const usersService = new UsersService();
