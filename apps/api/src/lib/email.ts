import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    logger.info({ to: options.to, subject: options.subject }, 'Email sent');
  } catch (error) {
    logger.error({ error, to: options.to }, 'Failed to send email');
    throw error;
  }
}

export function resetPasswordEmail(
  resetUrl: string,
  userName: string,
): { subject: string; html: string; text: string } {
  const subject = 'COMUNICA Social - Recuperar password';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a2e;">Recuperar Password</h2>
      <p>Olá <strong>${userName}</strong>,</p>
      <p>Recebemos um pedido para recuperar a sua password. Clique no botão abaixo para definir uma nova password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Redefinir Password
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">Este link expira em <strong>1 hora</strong>.</p>
      <p style="color: #666; font-size: 14px;">Se não pediu a recuperação de password, ignore este email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="color: #999; font-size: 12px;">COMUNICA Social - Gestão de Redes Sociais</p>
    </div>
  `;
  const text = `Olá ${userName},\n\nClique no link para redefinir a sua password: ${resetUrl}\n\nEste link expira em 1 hora.\n\nCOMUNICA Social`;
  return { subject, html, text };
}

export function inviteUserEmail(
  inviteUrl: string,
  inviterName: string,
  tenantName: string,
): { subject: string; html: string; text: string } {
  const subject = `COMUNICA Social - Convite para ${tenantName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a2e;">Convite para ${tenantName}</h2>
      <p>Olá,</p>
      <p><strong>${inviterName}</strong> convidou-o para se juntar a <strong>${tenantName}</strong> na plataforma COMUNICA Social.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteUrl}" style="background-color: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Aceitar Convite
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">Este convite expira em <strong>7 dias</strong>.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="color: #999; font-size: 12px;">COMUNICA Social - Gestão de Redes Sociais</p>
    </div>
  `;
  const text = `Olá,\n\n${inviterName} convidou-o para ${tenantName} na COMUNICA Social.\n\nAceite o convite: ${inviteUrl}\n\nEste convite expira em 7 dias.\n\nCOMUNICA Social`;
  return { subject, html, text };
}
