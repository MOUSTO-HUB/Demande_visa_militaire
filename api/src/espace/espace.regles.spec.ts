import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { CLE_ESPACE_MILITAIRE } from '../auth/decorators/espace-militaire.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PaysAccueil } from '../generated/prisma/enums.js';
import { CHAMPS } from '../referentiel/champs.js';
import {
  CHAMPS_MILITAIRE,
  etapes,
  IDS_CHAMPS_MILITAIRE,
  piecesDuMilitaire,
} from './champs-militaire.js';

describe('questions posées au militaire', () => {
  it('pose sa fiche personnelle, jamais les questions sensibles ni les réponses communes', () => {
    for (const id of ['nom', 'passeportNumero', 'pereNomComplet', 'email'])
      expect(IDS_CHAMPS_MILITAIRE.has(id), id).toBe(true);
    // Sensibles : relèvent de la DGRECM (cahier des charges, 3.3).
    for (const id of [
      'profession',
      'employeur',
      'serviceMilitaire',
      'antecedentsJudiciaires',
    ])
      expect(IDS_CHAMPS_MILITAIRE.has(id), id).toBe(false);
    // Communes à la campagne : saisies une fois par la DGRECM.
    for (const id of ['etablissementAccueil', 'dateArrivee', 'financement'])
      expect(IDS_CHAMPS_MILITAIRE.has(id), id).toBe(false);
    expect(CHAMPS_MILITAIRE.length).toBeLessThan(CHAMPS.length);
  });

  it('découpe le formulaire en étapes non vides', () => {
    const e = etapes();
    expect(e.length).toBeGreaterThan(3);
    for (const s of e)
      expect(CHAMPS_MILITAIRE.some((c) => c.section === s.code)).toBe(true);
    expect(e.map((s) => s.code)).not.toContain('DECLARATIONS');
  });

  it('propose les pièces de la campagne et « Autre document »', () => {
    const pieces = piecesDuMilitaire(PaysAccueil.CHINE, []);
    expect(pieces.map((p) => p.code)).toContain('PHOTO');
    expect(pieces.at(-1)).toEqual({
      code: 'AUTRE',
      libelle: 'Autre document',
      exigee: false,
    });
  });
});

describe('séparation des jetons agent / militaire', () => {
  const jwt = new JwtService({
    secret: 'secret-de-test-0123456789-0123456789',
  });
  const garde = (espace: boolean) => {
    const reflecteur = {
      getAllAndOverride: (cle: string) =>
        cle === CLE_ESPACE_MILITAIRE ? espace : undefined,
    } as unknown as Reflector;
    return new JwtAuthGuard(jwt, reflecteur);
  };
  const contexte = (jeton: string) => {
    const requete: Record<string, unknown> = {
      headers: { authorization: `Bearer ${jeton}` },
    };
    return {
      requete,
      ctx: {
        getHandler: () => undefined,
        getClass: () => undefined,
        switchToHttp: () => ({ getRequest: () => requete }),
      } as unknown as ExecutionContext,
    };
  };

  it("donne au militaire son seul dossier, et rien d'autre", async () => {
    const jeton = await jwt.signAsync({ sub: 'dossier-1', typ: 'militaire' });
    const { requete, ctx } = contexte(jeton);
    await expect(garde(true).canActivate(ctx)).resolves.toBe(true);
    expect(requete.militaire).toEqual({ dossierId: 'dossier-1' });
    expect(requete.utilisateur).toBeUndefined();
    await expect(
      garde(false).canActivate(contexte(jeton).ctx),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuse le jeton d'un agent dans l'espace du militaire", async () => {
    const jeton = await jwt.signAsync({ sub: 'agent-1', role: 'ADMIN' });
    await expect(
      garde(true).canActivate(contexte(jeton).ctx),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(garde(false).canActivate(contexte(jeton).ctx)).resolves.toBe(
      true,
    );
  });
});
