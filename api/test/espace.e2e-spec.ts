// Espace du militaire, de bout en bout : lien, code, information, saisie, envoi,
// et cloisonnement (critère de recette n° 6 : un militaire ne voit que sa fiche).
import {
  agent,
  appel,
  demarrer,
  envois,
  imageFictive,
  type Api,
} from './outils-e2e.js';

let api: Api;
let gestion: string;
let dossierA: string;
let dossierB: string;
let pieceB: string;
let lienA: string;
let lienB: string;

const jetonDe = (lien: string) => lien.split('/m/')[1];

/** Le militaire ouvre son lien, reçoit son code par email et se connecte. */
async function connecterMilitaire(lien: string, email: string) {
  const jeton = jetonDe(lien);
  // Un code par minute au plus (protection) : les tests n'attendent pas.
  await api.prisma.accesMilitaire.updateMany({ data: { codeEnvoyeLe: null } });
  const demande = await appel(api, null, 'POST', '/espace/code', {
    jeton,
    canal: 'EMAIL',
  });
  expect(demande.statut).toBe(200);
  const message = envois.findLast(
    (e) => e.destinataire === email && e.sujet === 'Votre code de connexion',
  );
  const code = /code de connexion est : (\d{6})/.exec(message!.texte)![1];
  const session = await appel(api, null, 'POST', '/espace/connexion', {
    jeton,
    code,
  });
  expect(session.statut).toBe(200);
  return { session: session.contenu.jeton as string, code };
}

beforeAll(async () => {
  api = await demarrer();
  gestion = await agent(api, 'GESTIONNAIRE');
  const campagne = await appel(api, gestion, 'POST', '/campagnes', {
    libelle: 'Campagne de bout en bout (fictive)',
    pays: 'CHINE',
    annee: 2026,
    typeVisa: 'X1',
    dateLimiteFiche: '2099-12-31',
  });
  const ids: string[] = [];
  for (const [matricule, prenoms, email] of [
    ['E2E0001', 'ALPHA', 'alpha@e2e.test'],
    ['E2E0002', 'BETA', 'beta@e2e.test'],
  ]) {
    const m = await appel(api, gestion, 'POST', '/militaires', {
      matricule,
      nom: 'ESSAI',
      prenoms,
      email,
    });
    ids.push(m.contenu.id as string);
  }
  await appel(
    api,
    gestion,
    'POST',
    `/campagnes/${campagne.contenu.id}/dossiers`,
    {
      militaireIds: ids,
    },
  );
  const liste = await appel(
    api,
    gestion,
    'GET',
    `/dossiers?campagneId=${campagne.contenu.id}`,
  );
  const parPrenom = (p: string) =>
    liste.contenu.elements.find(
      (d: { militaire: { prenoms: string } }) => d.militaire.prenoms === p,
    ).id as string;
  dossierA = parPrenom('ALPHA');
  dossierB = parPrenom('BETA');

  const form = new FormData();
  form.set('type', 'PHOTO');
  form.set('fichier', await imageFictive(), 'photo-fictive.jpg');
  const piece = await appel(
    api,
    gestion,
    'POST',
    `/dossiers/${dossierB}/pieces`,
    form,
  );
  pieceB = piece.contenu.piece.id as string;

  lienA = (await appel(api, gestion, 'POST', `/dossiers/${dossierA}/acces`))
    .contenu.lien;
  lienB = (await appel(api, gestion, 'POST', `/dossiers/${dossierB}/acces`))
    .contenu.lien;
});

afterAll(() => api?.fermer());

describe('accès du militaire', () => {
  it("le lien d'accès part par la file d'envoi, sans être conservé dans l'historique", async () => {
    await api.traiterFile();
    const message = envois.find(
      (e) => e.destinataire === 'alpha@e2e.test' && e.texte.includes(lienA),
    );
    expect(message?.sujet).toContain('Votre demande de visa');
    const historique = await appel(
      api,
      gestion,
      'GET',
      `/dossiers/${dossierA}/messages`,
    );
    expect(JSON.stringify(historique.contenu)).not.toContain(jetonDe(lienA));
  });

  it('le lien seul ne suffit pas : il faut le code reçu', async () => {
    const ouvert = await appel(api, null, 'POST', '/espace/acces', {
      jeton: jetonDe(lienA),
    });
    expect(ouvert.statut).toBe(200);
    expect(ouvert.contenu.canaux[0].destinataire).toBe('a•••••@e2e.test');
    expect((await appel(api, null, 'GET', '/espace/dossier')).statut).toBe(401);
    const faux = await appel(api, null, 'POST', '/espace/acces', {
      jeton: 'x'.repeat(32),
    });
    expect(faux.statut).toBe(404);
  });

  it('un code ne sert qu’une fois, et le code d’un militaire n’ouvre pas le lien d’un autre', async () => {
    const { code } = await connecterMilitaire(lienA, 'alpha@e2e.test');
    const encore = await appel(api, null, 'POST', '/espace/connexion', {
      jeton: jetonDe(lienA),
      code,
    });
    expect(encore.statut).toBe(401);
    const autre = await appel(api, null, 'POST', '/espace/connexion', {
      jeton: jetonDe(lienB),
      code,
    });
    expect(autre.statut).toBe(401);
  });
});

describe('cloisonnement (critère de recette n° 6)', () => {
  let militaire: string;
  beforeAll(async () => {
    militaire = (await connecterMilitaire(lienA, 'alpha@e2e.test')).session;
  });

  it('ne donne que sa propre fiche', async () => {
    const fiche = await appel(api, militaire, 'GET', '/espace/dossier');
    expect(fiche.contenu.militaire.prenoms).toBe('ALPHA');
  });

  it("refuse les routes des agents, le dossier et les pièces d'un autre", async () => {
    for (const [methode, chemin] of [
      ['GET', `/dossiers/${dossierB}`],
      ['GET', '/dossiers'],
      ['GET', `/pieces/${pieceB}/fichier`],
      ['GET', '/auth/moi'],
      ['GET', '/alertes'],
    ])
      expect(
        (await appel(api, militaire, methode, chemin)).statut,
        chemin,
      ).toBe(403);
    // Pièce d'un autre dossier : comme si elle n'existait pas.
    await appel(api, militaire, 'POST', '/espace/consentement', {
      version: (await appel(api, militaire, 'GET', '/espace/dossier')).contenu
        .consentement.version,
    });
    expect(
      (await appel(api, militaire, 'DELETE', `/espace/pieces/${pieceB}`))
        .statut,
    ).toBe(404);
  });

  it("refuse le jeton d'un agent dans l'espace du militaire", async () => {
    expect((await appel(api, gestion, 'GET', '/espace/dossier')).statut).toBe(
      403,
    );
  });
});

describe('fiche du militaire', () => {
  let militaire: string;
  beforeAll(async () => {
    militaire = (await connecterMilitaire(lienB, 'beta@e2e.test')).session;
  });

  it("demande d'accepter l'information sur les données avant toute saisie", async () => {
    const fiche = await appel(api, militaire, 'GET', '/espace/dossier');
    expect(fiche.contenu.consentement.accepte).toBe(false);
    const avant = await appel(api, militaire, 'PUT', '/espace/donnees', {
      valeurs: { lieuNaissanceVille: 'Kindia' },
    });
    expect(avant.statut).toBe(403);
    await appel(api, militaire, 'POST', '/espace/consentement', {
      version: fiche.contenu.consentement.version,
    });
    const apres = await appel(api, militaire, 'PUT', '/espace/donnees', {
      valeurs: { lieuNaissanceVille: 'Kindia' },
    });
    expect(apres.statut).toBe(200);
  });

  it('refuse les questions réservées à la DGRECM', async () => {
    const r = await appel(api, militaire, 'PUT', '/espace/donnees', {
      valeurs: { profession: 'ESSAI' },
    });
    expect(r.statut).toBe(400);
  });

  it("refuse l'envoi incomplet, puis envoie la fiche complète et la fige", async () => {
    const incomplet = await appel(api, militaire, 'POST', '/espace/envoi');
    expect(incomplet.statut).toBe(400);
    expect(incomplet.contenu.message).toMatch(/Il manque \d+ réponse/);

    const fiche = await appel(api, militaire, 'GET', '/espace/dossier');
    await appel(api, militaire, 'PUT', '/espace/donnees', {
      valeurs: reponsesFictives(fiche.contenu),
    });
    const envoi = await appel(api, militaire, 'POST', '/espace/envoi');
    expect(envoi.statut, JSON.stringify(envoi.contenu)).toBe(200);
    expect(envoi.contenu.statut).toBe('A_VALIDER');
    const fige = await appel(api, militaire, 'PUT', '/espace/donnees', {
      valeurs: { lieuNaissanceVille: 'Conakry' },
    });
    expect(fige.statut).toBe(403);
  });

  it('reçoit le motif quand la DGRECM lui renvoie sa fiche, et peut corriger', async () => {
    const renvoi = await appel(
      api,
      gestion,
      'POST',
      `/dossiers/${dossierB}/statut`,
      {
        statut: 'A_COMPLETER',
        commentaire: 'Photo à refaire',
      },
    );
    expect(renvoi.statut).toBe(200);
    await api.traiterFile();
    expect(
      envois.some(
        (e) =>
          e.destinataire === 'beta@e2e.test' &&
          e.texte.includes('Photo à refaire'),
      ),
    ).toBe(true);
    const fiche = await appel(api, militaire, 'GET', '/espace/dossier');
    expect(fiche.contenu.commentaire).toBe('Photo à refaire');
    expect(fiche.contenu.modifiable).toBe(true);
  });
});

/** Réponses fictives valables pour toutes les questions obligatoires de la fiche. */
function reponsesFictives(fiche: {
  sections: {
    champs: {
      id: string;
      type: string;
      obligatoire: string[];
      valeur: string | null;
      options?: { valeur: string }[];
    }[];
  }[];
}): Record<string, string> {
  const dates: Record<string, string> = {
    dateNaissance: '1998-03-05',
    passeportDateDelivrance: '2024-01-10',
    passeportDateExpiration: '2034-01-09',
  };
  const valeurs: Record<string, string> = {};
  for (const c of fiche.sections.flatMap((s) => s.champs)) {
    if (!c.obligatoire.includes('CHINE') || c.valeur) continue;
    valeurs[c.id] =
      c.type === 'date'
        ? (dates[c.id] ?? '2000-01-01')
        : c.type === 'liste'
          ? c.options![0].valeur
          : c.type === 'oui_non'
            ? 'NON'
            : c.type === 'telephone'
              ? '+224621000001'
              : c.type === 'email'
                ? 'beta@e2e.test'
                : c.id === 'passeportNumero'
                  ? 'R0123456'
                  : 'ESSAI';
  }
  return valeurs;
}
