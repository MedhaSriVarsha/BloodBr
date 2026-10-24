import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/types.js';

export class ConsentService {
  async getConsentPreferences(userId: string) {
    const records = await prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { grantedAt: 'desc' },
    });

    const contactRecord = records.find((r) => r.purpose === 'contact_sharing');
    const emergencyRecord = records.find((r) => r.purpose === 'emergency_broadcast');
    const smsRecord = records.find((r) => r.purpose === 'sms_alerts');

    return {
      contactSharingAllowed: contactRecord ? contactRecord.isGranted : false,
      emergencyBroadcastAllowed: emergencyRecord ? emergencyRecord.isGranted : true,
      smsNotificationsAllowed: smsRecord ? smsRecord.isGranted : true,
      lastUpdated: records[0]?.grantedAt.toISOString() || new Date().toISOString(),
    };
  }

  async updateConsent(
    userId: string,
    updates: {
      contactSharingAllowed?: boolean;
      emergencyBroadcastAllowed?: boolean;
      smsNotificationsAllowed?: boolean;
    }
  ) {
    const policyVersion = 'v2.4-2026';

    await prisma.$transaction(async (tx) => {
      if (updates.contactSharingAllowed !== undefined) {
        await tx.consentRecord.create({
          data: {
            userId,
            purpose: 'contact_sharing',
            policyVersion,
            isGranted: updates.contactSharingAllowed,
            revokedAt: updates.contactSharingAllowed ? null : new Date(),
          },
        });
      }

      if (updates.emergencyBroadcastAllowed !== undefined) {
        await tx.consentRecord.create({
          data: {
            userId,
            purpose: 'emergency_broadcast',
            policyVersion,
            isGranted: updates.emergencyBroadcastAllowed,
            revokedAt: updates.emergencyBroadcastAllowed ? null : new Date(),
          },
        });
      }

      if (updates.smsNotificationsAllowed !== undefined) {
        await tx.consentRecord.create({
          data: {
            userId,
            purpose: 'sms_alerts',
            policyVersion,
            isGranted: updates.smsNotificationsAllowed,
            revokedAt: updates.smsNotificationsAllowed ? null : new Date(),
          },
        });
      }
    });

    return this.getConsentPreferences(userId);
  }

  async listConsentsAdmin(params: { status?: string; page?: number; pageSize?: number }) {
    const { status, page = 1, pageSize = 10 } = params;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.isGranted = status === 'active';
    }

    const total = await prisma.consentRecord.count({ where });
    const records = await prisma.consentRecord.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { grantedAt: 'desc' },
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    const items = records.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.fullName,
      userEmail: r.user.email,
      consentType: r.purpose,
      purpose: r.purpose,
      policyVersion: r.policyVersion,
      status: r.isGranted ? 'active' : 'withdrawn',
      grantedAt: r.grantedAt.toISOString(),
      revokedAt: r.revokedAt ? r.revokedAt.toISOString() : undefined,
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }
}

export const consentService = new ConsentService();
