import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { CanalMessage } from '../generated/prisma/enums.js';

export type ResultatEnvoi = 'ENVOYE' | 'SIMULE';

/**
 * Envoi des emails (serveur SMTP de la DGSIC) et des SMS (fournisseur local,
 * optionnel). Sans configuration :
 * - en développement, le message est écrit dans le journal de l'API (SIMULE) ;
 * - en production, l'envoi échoue avec un message clair (jamais de faux succès).
 */
@Injectable()
export class EnvoiService {
  private readonly journal = new Logger('Envois');
  private readonly production: boolean;
  private readonly smtp: Transporter | null;
  private readonly expediteur: string;
  private readonly sms: {
    url: string;
    jeton?: string;
    expediteur?: string;
  } | null;

  constructor(config: ConfigService) {
    this.production = config.get('NODE_ENV') === 'production';
    const hote = config.get<string>('SMTP_HOST');
    this.smtp = hote
      ? createTransport({
          host: hote,
          port: Number(config.get('SMTP_PORT') ?? 587),
          secure: config.get('SMTP_SECURE') === 'oui',
          auth: config.get<string>('SMTP_UTILISATEUR')
            ? {
                user: config.get<string>('SMTP_UTILISATEUR'),
                pass: config.get<string>('SMTP_MOT_DE_PASSE'),
              }
            : undefined,
        })
      : null;
    this.expediteur =
      config.get<string>('EMAIL_EXPEDITEUR') ?? 'DGRECM <visa@dgrecm.gn>';
    const url = config.get<string>('SMS_URL');
    this.sms = url
      ? {
          url,
          jeton: config.get<string>('SMS_JETON'),
          expediteur: config.get<string>('SMS_EXPEDITEUR'),
        }
      : null;
  }

  /** Les SMS sont optionnels (coût par message) : disponibles si un fournisseur est configuré. */
  get smsDisponibles(): boolean {
    return !!this.sms || !this.production;
  }

  async envoyer(
    canal: CanalMessage,
    destinataire: string,
    sujet: string,
    texte: string,
  ): Promise<ResultatEnvoi> {
    if (canal === CanalMessage.EMAIL) {
      if (!this.smtp) return this.simuler(canal, destinataire, texte);
      await this.smtp.sendMail({
        from: this.expediteur,
        to: destinataire,
        subject: sujet,
        text: texte,
      });
      return 'ENVOYE';
    }
    if (!this.sms) return this.simuler(canal, destinataire, texte);
    // Passerelle HTTP générique : { to, from, message } en JSON. À adapter au
    // fournisseur retenu (Orange, MTN ou agrégateur) lors de la mise en service.
    const reponse = await fetch(this.sms.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.sms.jeton
          ? { Authorization: `Bearer ${this.sms.jeton}` }
          : {}),
      },
      body: JSON.stringify({
        to: destinataire,
        from: this.sms.expediteur,
        message: texte,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!reponse.ok)
      throw new Error(`Fournisseur SMS : réponse ${reponse.status}.`);
    return 'ENVOYE';
  }

  private simuler(
    canal: CanalMessage,
    destinataire: string,
    texte: string,
  ): ResultatEnvoi {
    if (this.production)
      throw new Error(
        canal === CanalMessage.EMAIL
          ? "Serveur d'email non configuré (SMTP_HOST)."
          : 'Fournisseur SMS non configuré (SMS_URL).',
      );
    this.journal.log(`[simulation ${canal}] à ${destinataire} :\n${texte}`);
    return 'SIMULE';
  }
}
