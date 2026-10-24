import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from './logger.js';

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
        tls: {
          rejectUnauthorized: false, // Compatibility with varied certificates
        },
      });
    } catch (err: any) {
      logger.error('Failed to initialize nodemailer transporter:', err.message);
    }
  }

  async sendOtpEmail(toEmail: string, otpCode: string, purpose: string): Promise<boolean> {
    if (!this.transporter) {
      this.initTransporter();
    }

    const subject = `Your BloodBridge Verification Code: ${otpCode}`;
    const purposeText = purpose === 'registration' 
      ? 'complete your BloodBridge account registration'
      : purpose === 'password_reset'
      ? 'reset your BloodBridge account password'
      : 'verify your email address';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #E6E8EC; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #B91C2C; margin: 0;">BloodBridge</h2>
          <p style="color: #69717D; font-size: 14px; margin-top: 4px;">Be a Donor. Be a Savior.</p>
        </div>
        <p style="color: #20252B; font-size: 16px;">Hello,</p>
        <p style="color: #20252B; font-size: 15px; line-height: 1.5;">
          Use the 6-digit verification code below to ${purposeText}. This code will expire in 5 minutes.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #B91C2C; background-color: #F7F8FA; padding: 12px 24px; border-radius: 8px; border: 1px dashed #B91C2C;">
            ${otpCode}
          </span>
        </div>
        <p style="color: #69717D; font-size: 13px; line-height: 1.4;">
          If you did not request this code, you can safely ignore this email. Someone may have typed your email address by mistake.
        </p>
        <hr style="border: none; border-top: 1px solid #E6E8EC; margin: 24px 0;" />
        <p style="color: #9AA2AD; font-size: 12px; text-align: center; margin: 0;">
          BloodBridge Emergency Healthcare & Donor Network
        </p>
      </div>
    `;

    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      await this.transporter.sendMail({
        from: `"${config.smtp.fromName}" <${config.smtp.from}>`,
        to: toEmail,
        subject,
        html,
      });

      logger.info(`Successfully sent verification email to ${toEmail}`);
      return true;
    } catch (error: any) {
      logger.error(`Error sending email to ${toEmail}:`, error.message);
      // In development mode, if SMTP delivery encounters a network block, don't crash
      if (process.env.NODE_ENV === 'development') {
        logger.warn(`[DEV SIMULATION] Email dispatch failed: ${error.message}`);
      }
      return false;
    }
  }

  async sendPasswordResetEmail(toEmail: string, resetLink: string): Promise<boolean> {
    if (!this.transporter) {
      this.initTransporter();
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #E6E8EC; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #B91C2C; margin: 0;">BloodBridge</h2>
          <p style="color: #69717D; font-size: 14px; margin-top: 4px;">Be a Donor. Be a Savior.</p>
        </div>
        <p style="color: #20252B; font-size: 16px;">Hello,</p>
        <p style="color: #20252B; font-size: 15px; line-height: 1.5;">
          We received a request to reset the password for your BloodBridge account. Click the button below to choose a new password:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetLink}" style="display: inline-block; background-color: #B91C2C; color: #FFFFFF; font-size: 15px; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 6px;">
            Reset Password
          </a>
        </div>
        <p style="color: #69717D; font-size: 13px; line-height: 1.4;">
          This link will expire in 15 minutes. If you did not request a password reset, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #E6E8EC; margin: 24px 0;" />
        <p style="color: #9AA2AD; font-size: 12px; text-align: center; margin: 0;">
          BloodBridge Emergency Healthcare & Donor Network
        </p>
      </div>
    `;

    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      await this.transporter.sendMail({
        from: `"${config.smtp.fromName}" <${config.smtp.from}>`,
        to: toEmail,
        subject: 'Reset Your BloodBridge Password',
        html,
      });

      logger.info(`Password reset email sent to ${toEmail}`);
      return true;
    } catch (error: any) {
      logger.error(`Error sending password reset email to ${toEmail}:`, error.message);
      return false;
    }
  }
}

export const emailService = new EmailService();
