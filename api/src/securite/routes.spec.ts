import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { RequestMethod } from '@nestjs/common';
import { AppController } from '../app.controller.js';
import { AuditController } from '../audit/audit.controller.js';
import { AuthController } from '../auth/auth.controller.js';
import { CLE_AVANT_DOUBLE_AUTH } from '../auth/decorators/avant-double-auth.decorator.js';
import { DoubleAuthController } from '../auth/double-auth.controller.js';
import { CLE_PUBLIC } from '../auth/decorators/public.decorator.js';
import { CLE_ROLES } from '../auth/decorators/roles.decorator.js';
import { CampagnesController } from '../campagnes/campagnes.controller.js';
import { CLE_ESPACE_MILITAIRE } from '../auth/decorators/espace-militaire.decorator.js';
import { DossiersController } from '../dossiers/dossiers.controller.js';
import { AccesController } from '../espace/acces.controller.js';
import { EspaceController } from '../espace/espace.controller.js';
import { MilitairesController } from '../militaires/militaires.controller.js';
import { MrzController } from '../mrz/mrz.controller.js';
import { PiecesController } from '../pieces/pieces.controller.js';
import { ReferentielController } from '../referentiel/referentiel.controller.js';
import { SitesController } from '../sites/sites.controller.js';
import { SuiviController } from '../suivi/suivi.controller.js';
import { UtilisateursController } from '../utilisateurs/utilisateurs.controller.js';

/**
 * Inventaire des routes : chacune doit porter @Roles(...) ou @Public(), sauf
 * celles listées ici avec leur justification (ouvertes à tout compte connecté).
 * Un nouveau contrôleur doit être ajouté à CONTROLEURS.
 */
const OUVERTES_A_TOUS_CONNECTES: Record<string, string> = {
  'GET /auth/moi': 'chacun lit son propre profil',
  'POST /auth/mot-de-passe': 'chacun change son propre mot de passe',
  'GET /auth/double-auth': 'état de sa propre double authentification',
  'POST /auth/double-auth/preparation':
    'chacun configure son application (mot de passe redemandé)',
  'POST /auth/double-auth/activation': 'chacun active sa propre application',
  'POST /auth/double-auth/codes-secours':
    'chacun régénère ses codes (mot de passe redemandé)',
  'POST /auth/double-auth/desactivation':
    'refusée par le service pour les rôles où elle est obligatoire',
  'GET /referentiel':
    'dictionnaire des champs et des pièces, sans donnée personnelle',
};

const CONTROLEURS = [
  AccesController,
  AppController,
  AuditController,
  AuthController,
  CampagnesController,
  DossiersController,
  DoubleAuthController,
  EspaceController,
  MilitairesController,
  MrzController,
  PiecesController,
  ReferentielController,
  SitesController,
  SuiviController,
  UtilisateursController,
];

interface Route {
  route: string;
  roles?: string[];
  public?: boolean;
  avantDoubleAuth?: boolean;
  espace?: boolean;
}

function routes(): Route[] {
  const resultat: Route[] = [];
  for (const controleur of CONTROLEURS) {
    const prefixe = String(
      Reflect.getMetadata(PATH_METADATA, controleur) ?? '',
    );
    const prototype = controleur.prototype as unknown as Record<
      string,
      unknown
    >;
    for (const nom of Object.getOwnPropertyNames(prototype)) {
      const methode = prototype[nom];
      if (nom === 'constructor' || typeof methode !== 'function') continue;
      const verbe = Reflect.getMetadata(METHOD_METADATA, methode) as
        RequestMethod | undefined;
      if (verbe === undefined) continue;
      const chemin = String(Reflect.getMetadata(PATH_METADATA, methode) ?? '');
      const complet = ['', prefixe, chemin]
        .join('/')
        .replace(/\/+/g, '/')
        .replace(/\/$/, '');
      const lire = (cle: string) =>
        Reflect.getMetadata(cle, methode) ??
        Reflect.getMetadata(cle, controleur);
      resultat.push({
        route: `${RequestMethod[verbe]} ${complet}`,
        roles: lire(CLE_ROLES) as string[] | undefined,
        public: lire(CLE_PUBLIC) as boolean | undefined,
        avantDoubleAuth: lire(CLE_AVANT_DOUBLE_AUTH) as boolean | undefined,
        espace: lire(CLE_ESPACE_MILITAIRE) as boolean | undefined,
      });
    }
  }
  return resultat;
}

describe('droits des routes', () => {
  const inventaire = routes();

  it('trouve les routes des contrôleurs', () => {
    expect(inventaire.length).toBeGreaterThan(30);
  });

  it.each(inventaire.map((r) => [r.route, r]))(
    '%s déclare qui peut y accéder',
    (route, r) => {
      const declaree = r.public || r.espace || (r.roles?.length ?? 0) > 0;
      expect(
        declaree || route in OUVERTES_A_TOUS_CONNECTES,
        `${route} : ajouter @Roles(...) ou @Public()`,
      ).toBe(true);
    },
  );

  it('ne garde pas de justification pour une route disparue', () => {
    const existantes = new Set(inventaire.map((r) => r.route));
    for (const route of Object.keys(OUVERTES_A_TOUS_CONNECTES))
      expect(existantes.has(route), route).toBe(true);
  });

  it('ne laisse aucune route publique hors connexion et supervision', () => {
    expect(
      inventaire
        .filter((r) => r.public)
        .map((r) => r.route)
        .sort(),
    ).toEqual([
      'GET /sante',
      'POST /auth/connexion',
      'POST /auth/deconnexion',
      'POST /auth/double-auth/verification',
      'POST /auth/rafraichir',
      'POST /espace/acces',
      'POST /espace/code',
      'POST /espace/connexion',
    ]);
  });

  it('n’ouvre avant la double authentification que le profil, le mot de passe et son activation', () => {
    expect(
      inventaire
        .filter((r) => r.avantDoubleAuth)
        .map((r) => r.route)
        .sort(),
    ).toEqual([
      'GET /auth/double-auth',
      'GET /auth/moi',
      'POST /auth/double-auth/activation',
      'POST /auth/double-auth/codes-secours',
      'POST /auth/double-auth/desactivation',
      'POST /auth/double-auth/preparation',
      'POST /auth/mot-de-passe',
    ]);
  });

  it("limite l'espace du militaire à ses routes /espace, sans rôle d'agent", () => {
    const espace = inventaire.filter((r) => r.espace);
    expect(espace.map((r) => r.route).sort()).toEqual([
      'DELETE /espace/pieces/:id',
      'GET /espace/dossier',
      'POST /espace/consentement',
      'POST /espace/envoi',
      'POST /espace/pieces',
      'PUT /espace/donnees',
    ]);
    for (const r of espace) {
      expect(r.roles, r.route).toBeUndefined();
      expect(r.public, r.route).toBeFalsy();
    }
    // Aucune route /espace ouverte autrement que par le lien ou le jeton du militaire.
    for (const r of inventaire.filter((r) => r.route.includes(' /espace/')))
      expect(r.public || r.espace, r.route).toBe(true);
  });

  it("n'ouvre jamais les pièces ni le journal au lecteur", () => {
    for (const r of inventaire.filter(
      (r) => r.route.includes('/pieces') || r.route.includes('/journal'),
    ))
      expect(r.roles ?? [], r.route).not.toContain('LECTEUR');
  });
});
