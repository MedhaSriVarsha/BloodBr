import { Request, Response, NextFunction } from 'express';
import { referralService } from './referrals.service.js';

export class ReferralController {
  async validateCode(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await referralService.validateReferralCode(req.params.code);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await referralService.getReferralStats(req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async share(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await referralService.shareReferral(req.user!.userId, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const referralController = new ReferralController();
