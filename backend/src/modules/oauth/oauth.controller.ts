import { Request, Response, NextFunction } from 'express';
import { oauthService } from './oauth.service.js';

export class OAuthController {
  getGoogleUrl(req: Request, res: Response) {
    const url = oauthService.getGoogleAuthUrl();
    res.json({ url });
  }

  async googleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string | undefined;

      if (!code) {
        return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'Missing OAuth authorization code.' });
      }

      const result = await oauthService.handleGoogleCallback(code, state);
      // Redirect to frontend with token
      res.redirect(result.redirectUrl);
    } catch (error) {
      next(error);
    }
  }
}

export const oauthController = new OAuthController();
