import type { Transporter } from "nodemailer";

import { env } from "../../config/env";
import { logger, maskEmail } from "../../shared/utils/logger";

type PasswordResetEmailInput = {
  to: string;
  displayName: string;
  code: string;
  expiresInSeconds: number;
  challengeId: string;
};

export interface Mailer {
  sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void>;
}

class SmtpMailer implements Mailer {
  private transporter?: Transporter;

  async sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
    this.transporter ??= (await import("nodemailer")).createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth:
        env.smtpUser && env.smtpPass
          ? { user: env.smtpUser, pass: env.smtpPass }
          : undefined,
    });
    const transporter = this.transporter;

    const resetUrl = `${env.appResetUrl}?challengeId=${encodeURIComponent(input.challengeId)}`;
    const greeting = input.displayName.trim() ? `Hi ${input.displayName},` : "Hi,";

    await transporter.sendMail({
      from: env.mailFrom,
      to: input.to,
      subject: "Your Sayly password reset code",
      text: [
        greeting,
        "",
        `Your password reset code is: ${input.code}`,
        `This code expires in ${Math.max(1, Math.round(input.expiresInSeconds / 60))} minute(s).`,
        "",
        `If your app asks for a challenge id, use: ${input.challengeId}`,
        `Or open: ${resetUrl}`,
        "",
        "If you did not request this, you can ignore this email.",
      ].join("\n"),
    });
  }
}

class QuietMailer implements Mailer {
  async sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
    logger.info("mail", "password reset email queued", {
      to: maskEmail(input.to),
      expiresInSeconds: input.expiresInSeconds,
      // Local/dev without SMTP: surface the code in server logs.
      ...(env.isProduction ? {} : { devCode: input.code, challengeId: input.challengeId }),
    });
  }
}

const mailer: Mailer = env.smtpHost && env.mailFrom ? new SmtpMailer() : new QuietMailer();

export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
  await mailer.sendPasswordResetEmail(input);
}
