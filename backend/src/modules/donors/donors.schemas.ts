import { z } from 'zod';

export const donorRegistrationSchema = z.object({
  referralCode: z.string().min(1, 'Referral code is required'),
  fullName: z.string().min(2, 'Full name is required'),
  mobileNumber: z.string().min(8, 'Valid phone number is required'),
  email: z.string().email('Valid email address is required'),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  state: z.string().min(1, 'State is required'),
  district: z.string().min(1, 'District is required'),
  city: z.string().min(1, 'City is required'),
  donationWillingness: z.enum(['regular', 'emergency_only', 'occasional']).default('regular'),
  contactConsent: z.boolean(),
  privacyAcknowledged: z.boolean(),
  termsAccepted: z.boolean(),
});

export const updateDonorSchema = z.object({
  fullName: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  donationWillingness: z.enum(['regular', 'emergency_only', 'occasional']).optional(),
  isAvailable: z.boolean().optional(),
});

export const reportDonorSchema = z.object({
  reason: z.string().min(5, 'Please provide a clear reason for reporting'),
});

export const donorListQuerySchema = z.object({
  search: z.string().optional(),
  bloodGroup: z.string().optional(),
  status: z.string().optional(),
  state: z.string().optional(),
  district: z.string().optional(),
  page: z.string().regex(/^\d+$/).default('1').transform(Number),
  pageSize: z.string().regex(/^\d+$/).default('10').transform(Number),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type DonorRegistrationPayload = z.infer<typeof donorRegistrationSchema>;
export type UpdateDonorPayload = z.infer<typeof updateDonorSchema>;
export type ReportDonorPayload = z.infer<typeof reportDonorSchema>;
export type DonorListQueryParams = z.infer<typeof donorListQuerySchema>;
