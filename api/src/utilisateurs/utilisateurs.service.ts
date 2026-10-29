import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { AuditService } from '../audit/audit.service.js';
import { AuthService } from '../auth/auth.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { estDoublon } from '../common/erreurs-prisma.js';
import { ActionAudit, Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreationUtilisateurDto,
  ModificationUtilisateurDto,
} from './utilisateurs.dto.js';
import { motDePasseProvisoire } from './utilisateurs.regles.js';

const CHAMPS = {
  id: true,
  prenoms: true,
  nom: true,
  email: true,
  role: true,
  actif: true,
  motDePasseProvisoire: true,
  derniereConnexion: true,
  bloqueJusquA: true,
  creeLe: true,
} as const;

@Injectable()
export class UtilisateursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  lister() {
    return this.prisma.utilisateur.findMany({
      select: CHAMPS,
      orderBy: [{ actif: 'desc' }, { nom: 'asc' }],
    });
  }

  /** Agents à qui la gestion peut attribuer des dossiers. */
  operateurs() {
    return this.prisma.utilisateur.findMany({
      where: {
        actif: true,
        role: { in: [Role.OPERATEUR, Role.GESTIONNAIRE, Role.ADMIN] },
      },
      select: { id: true, prenoms: true, nom: true, role: true },
      orderBy: { nom: 'asc' },
    });
  }

  /** Le mot de passe provisoire n'est renvoyé qu'une fois : il n'est pas conservé en clair. */
  async creer(u: UtilisateurConnecte, dto: CreationUtilisateurDto) {
    const provisoire = motDePasseProvisoire();
    try {
      const cree = await this.prisma.utilisateur.create({
        data: {
          ...dto,
          motDePasseHash: await hash(provisoire),
          motDePasseProvisoire: true,
          creePar: u.id,
        },
        select: CHAMPS,
      });
      await this.audit.journaliser(
        u,
        ActionAudit.CREATION,
        'Utilisateur',
        cree.id,
        { role: cree.role },
      );
      return { utilisateur: cree, motDePasseProvisoire: provisoire };
    } catch (e) {
      if (estDoublon(e))
        throw new ConflictException('Un compte utilise déjà cet email.');
      throw e;
    }
  }

  async modifier(
    u: UtilisateurConnecte,
    id: string,
    dto: ModificationUtilisateurDto,
  ) {
    await this.existant(id);
    if (
      id === u.id &&
      (dto.actif === false || (dto.role && dto.role !== u.role))
    )
      throw new BadRequestException(
        'Vous ne pouvez pas désactiver votre propre compte ni changer votre rôle.',
      );
    const modifie = await this.prisma.utilisateur.update({
      where: { id },
      data: dto,
      select: CHAMPS,
    });
    if (dto.actif === false) await this.auth.revoquerTout(id);
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'Utilisateur',
      id,
      { ...dto },
    );
    return modifie;
  }

  /** Nouveau mot de passe provisoire ; débloque le compte et ferme ses sessions. */
  async reinitialiser(u: UtilisateurConnecte, id: string) {
    await this.existant(id);
    const provisoire = motDePasseProvisoire();
    await this.prisma.utilisateur.update({
      where: { id },
      data: {
        motDePasseHash: await hash(provisoire),
        motDePasseProvisoire: true,
        echecsConnexion: 0,
        bloqueJusquA: null,
      },
    });
    await this.auth.revoquerTout(id);
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'Utilisateur',
      id,
      {
        reinitialisation: true,
      },
    );
    return { motDePasseProvisoire: provisoire };
  }

  private async existant(id: string) {
    const trouve = await this.prisma.utilisateur.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!trouve) throw new NotFoundException('Compte introuvable.');
  }
}
