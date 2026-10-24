import type { DonorService } from '../contracts';
import type { PaginatedResult } from '../../../types/api';
import type {
  DonorSummary,
  DonorDetails,
  DonorRegistrationInput,
  DonorRegistrationResult,
  DonorListParams,
} from '../../../types/donor';
import { apiClient } from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';

export class HttpDonorService implements DonorService {
  async listMyDonors(params: DonorListParams): Promise<PaginatedResult<DonorSummary>> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.bloodGroup && params.bloodGroup !== 'ALL') query.set('bloodGroup', params.bloodGroup);
    if (params.status && params.status !== 'ALL') query.set('status', params.status);
    if (params.state) query.set('state', params.state);
    if (params.district) query.set('district', params.district);
    if (params.page) query.set('page', params.page.toString());
    if (params.pageSize) query.set('pageSize', params.pageSize.toString());
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);

    const qs = query.toString();
    const url = `${ENDPOINTS.MY_DONORS}${qs ? `?${qs}` : ''}`;
    return apiClient.get<PaginatedResult<DonorSummary>>(url);
  }

  async getDonorById(id: string): Promise<DonorDetails> {
    return apiClient.get<DonorDetails>(ENDPOINTS.DONOR_BY_ID(id));
  }

  async registerDonor(input: DonorRegistrationInput): Promise<DonorRegistrationResult> {
    return apiClient.post<DonorRegistrationResult>(ENDPOINTS.REGISTER_DONOR, input);
  }

  async updateDonor(id: string, input: Partial<DonorDetails>): Promise<DonorDetails> {
    return apiClient.put<DonorDetails>(ENDPOINTS.DONOR_BY_ID(id), input);
  }

  async reportIncorrectInfo(donorId: string, reason: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>(ENDPOINTS.REPORT_DONOR(donorId), { reason });
  }
}

export const httpDonorService = new HttpDonorService();
