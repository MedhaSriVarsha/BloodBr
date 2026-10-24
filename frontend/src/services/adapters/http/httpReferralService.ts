import type { ReferralService } from '../contracts';
import type {
  ReferralCodeValidation,
  ReferralStats,
  ShareInvitationPayload,
} from '../../../types/referral';
import { apiClient } from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';

export class HttpReferralService implements ReferralService {
  async validateReferralCode(code: string): Promise<ReferralCodeValidation> {
    return apiClient.get<ReferralCodeValidation>(ENDPOINTS.VALIDATE_CODE(code));
  }

  async getReferralStats(): Promise<ReferralStats> {
    return apiClient.get<ReferralStats>(ENDPOINTS.REFERRAL_STATS);
  }

  async shareReferral(payload: ShareInvitationPayload): Promise<{ success: boolean; shareUrl: string }> {
    return apiClient.post<{ success: boolean; shareUrl: string }>(ENDPOINTS.SHARE_REFERRAL, payload);
  }
}

export const httpReferralService = new HttpReferralService();
