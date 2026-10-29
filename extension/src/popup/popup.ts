// Fenêtre de l'extension : connexion, choix du dossier, relevé et remplissage
// de la page affichée, numéro de demande et pièces.
import {
  adresseApi,
  appel,
  definirAdresseApi,
  envoyer,
  ErreurApi,
  estConnecte,
  seConnecter,
  seDeconnecter,
  verifierCode,
} from '../commun/api.js';
import type {
  ChampSite,
  MessagePage,
  ReleveDePage,
  ResultatRemplissage,
} from '../commun/types.js';
import { planifier, type ModeRemplissage } from '../commun/valeurs.js';

/** Sites officiels pris en charge (le site russe viendra en phase 3). */
const SITES: Record<string, { pays: 'CHINE'; nom: string }> = {
  'consular.mfa.gov.cn': { pays: 'CHINE', nom: 'COVA (Chine)' },
};

interface DossierListe {
  id: string;
  statut: string;
  numeroDemande: string | null;
  militaire: { matricule: string; nom: string; prenoms: string };
  campagne: { libelle: string; pays: string };
}

interface DossierDetail extends DossierListe {
  valeurs: Record<string, string>;
  anomalies: { niveau: string }[];
  pieces: {
    id: string;
    type: string;
    nomFichier: string;
    purgeeLe: string | null;
  }[];
}

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const LIBELLES_STATUT: Record<string, string> = {
  VALIDE: 'Validé',
  EN_SAISIE: 'En saisie',
  SOUMIS: 'Soumis',
};

let onglet: chrome.tabs.Tab | undefined;
let site: (typeof SITES)[string] | undefined;
let dossier: DossierDetail | null = null;

function alerte(texte: string | null) {
  const el = $('alerte');
  el.hidden = !texte;
  el.textContent = texte ?? '';
}

function afficher(vue: 'parametres' | 'connexion' | 'principale') {
  for (const v of ['parametres', 'connexion', 'principale'])
    $(`vue-${v}`).hidden = v !== vue;
}

/** Exécute une action en désactivant les boutons et en affichant l'erreur éventuelle. */
async function tenter(action: () => Promise<void>) {
  alerte(null);
  const boutons = [...document.querySelectorAll('button')];
  boutons.forEach((b) => (b.disabled = true));
  try {
    await action();
  } catch (e) {
    alerte(e instanceof Error ? e.message : String(e));
    if (e instanceof ErreurApi && e.statut === 401) afficher('connexion');
  } finally {
    boutons.forEach((b) => (b.disabled = false));
  }
}

/** Message au script de la page affichée (cadre principal seulement). */
async function versPage<T>(message: MessagePage): Promise<T> {
  if (!onglet?.id || !site)
    throw new Error('Ouvrez le formulaire du site officiel dans cet onglet.');
  let reponse: { ok: boolean; valeur?: T; erreur?: string } | undefined;
  try {
    reponse = await chrome.tabs.sendMessage(onglet.id, message, { frameId: 0 });
  } catch {
    throw new Error(
      "La page n'est pas prête : rechargez-la (F5) puis rouvrez l'extension.",
    );
  }
  if (!reponse?.ok)
    throw new Error(reponse?.erreur ?? 'La page ne répond pas.');
  return reponse.valeur as T;
}

// ─── Dossiers ────────────────────────────────────────────────────────────────

async function chargerDossiers(q?: string) {
  const requetes = ['VALIDE', 'EN_SAISIE'].map((statut) => {
    const p = new URLSearchParams({ statut, parPage: '100' });
    if (q) p.set('q', q);
    else p.set('operateur', 'moi');
    return appel<{ elements: DossierListe[] }>(`/dossiers?${p}`);
  });
  // Sans recherche : mes dossiers en saisie, puis tous les dossiers validés en attente.
  if (!q) {
    const p = new URLSearchParams({ statut: 'VALIDE', parPage: '100' });
    requetes.push(appel<{ elements: DossierListe[] }>(`/dossiers?${p}`));
  }
  const vus = new Set<string>();
  const dossiers = (await Promise.all(requetes))
    .flatMap((r) => r.elements)
    .filter((d) => !vus.has(d.id) && vus.add(d.id))
    .filter((d) => !site || d.campagne.pays === site.pays);
  const liste = $<HTMLSelectElement>('dossier');
  liste.replaceChildren(
    new Option(
      dossiers.length
        ? '— Choisir un dossier —'
        : 'Aucun dossier validé à saisir',
      '',
    ),
    ...dossiers.map(
      (d) =>
        new Option(
          `${d.militaire.nom} ${d.militaire.prenoms} · ${d.militaire.matricule} · ${LIBELLES_STATUT[d.statut] ?? d.statut}`,
          d.id,
        ),
    ),
  );
  const { dossierId } = await chrome.storage.session.get('dossierId');
  if (
    typeof dossierId === 'string' &&
    dossiers.some((d) => d.id === dossierId)
  ) {
    liste.value = dossierId;
    await choisirDossier(dossierId);
  }
}

async function choisirDossier(id: string) {
  await chrome.storage.session.set({ dossierId: id });
  dossier = id ? await appel<DossierDetail>(`/dossiers/${id}`) : null;
  const resume = $('resume-dossier');
  $('bloc-soumission').hidden = dossier?.statut !== 'EN_SAISIE';
  const pieces = $('pieces');
  pieces.replaceChildren();
  if (!dossier) {
    resume.textContent = '';
    return;
  }
  const bloquants = dossier.anomalies.filter(
    (a) => a.niveau === 'BLOQUANT',
  ).length;
  resume.textContent = `${dossier.campagne.libelle} · ${LIBELLES_STATUT[dossier.statut] ?? dossier.statut}${dossier.numeroDemande ? ` · n° ${dossier.numeroDemande}` : ''}${bloquants ? ` · ${bloquants} point(s) bloquant(s)` : ''}`;
  for (const p of dossier.pieces.filter((x) => !x.purgeeLe)) {
    const li = document.createElement('li');
    const bouton = document.createElement('button');
    bouton.className = 'lien';
    bouton.textContent = `${p.type} · ${p.nomFichier}`;
    bouton.addEventListener('click', () =>
      tenter(async () => {
        const fichier = await appel<Blob>(
          `/pieces/${p.id}/fichier`,
          {},
          'blob',
        );
        const lien = document.createElement('a');
        lien.href = URL.createObjectURL(fichier);
        lien.download = p.nomFichier;
        lien.click();
        URL.revokeObjectURL(lien.href);
      }),
    );
    li.append(bouton);
    pieces.append(li);
  }
  if (!pieces.children.length)
    pieces.append(
      Object.assign(document.createElement('li'), {
        textContent: 'Aucune pièce.',
      }),
    );
}

// ─── Page du site officiel ───────────────────────────────────────────────────

async function relever() {
  const page = await versPage<ReleveDePage>({ action: 'relever' });
  if (!page.champs.length)
    throw new Error('Aucun champ de formulaire visible sur cette page.');
  const bilan = await envoyer<{
    nouveaux: number;
    obligatoires: number;
    obligatoiresSansCorrespondance: number;
  }>(`/sites/${site!.pays}/releves`, 'POST', {
    page: page.page,
    // L'état « rempli » de la page n'est pas enregistré.
    champs: page.champs.map((c) => ({
      cle: c.cle,
      libelle: c.libelle,
      type: c.type,
      obligatoire: c.obligatoire,
      options: c.options,
      formatDate: c.formatDate,
    })),
  });
  $('resultat').innerHTML = '';
  ajouterLigne(
    `${page.champs.length} champ(s) relevé(s) sur cette page, dont ${bilan.nouveaux} nouveau(x) et ${bilan.obligatoires} obligatoire(s).`,
    'ok',
  );
  if (bilan.obligatoiresSansCorrespondance)
    ajouterLigne(
      `${bilan.obligatoiresSansCorrespondance} champ(s) obligatoire(s) à relier dans la plateforme (« Correspondances COVA »).`,
      'manquant',
    );
  if (!page.vue)
    ajouterLigne(
      'Formulaire sans Element UI : remplissage par champs HTML simples.',
      '',
    );
}

async function remplir() {
  if (!dossier) throw new Error('Choisissez un dossier.');
  if (dossier.campagne.pays !== site!.pays)
    throw new Error(`Ce dossier n'est pas une demande pour ${site!.nom}.`);
  if (!['VALIDE', 'EN_SAISIE'].includes(dossier.statut))
    throw new Error(
      'Seul un dossier validé peut être saisi sur le site officiel.',
    );
  const [page, champs] = await Promise.all([
    versPage<ReleveDePage>({ action: 'relever' }),
    appel<ChampSite[]>(`/sites/${site!.pays}/champs`),
  ]);
  const plan = planifier(
    page.champs,
    champs.filter((c) => c.page === page.page),
    dossier.valeurs,
    $<HTMLSelectElement>('mode').value as ModeRemplissage,
  );
  if (dossier.statut === 'VALIDE') {
    // Le dossier passe « En saisie » et revient à l'agent qui le remplit.
    await envoyer(`/dossiers/${dossier.id}/statut`, 'POST', {
      statut: 'EN_SAISIE',
    });
    await choisirDossier(dossier.id);
  }
  const aSignaler = Object.fromEntries(
    plan.manquants.map((m) => [m.cle, 'manquant' as const]),
  );
  const resultat = await versPage<ResultatRemplissage>({
    action: 'remplir',
    ordres: plan.ordres,
    aSignaler,
  });
  await envoyer(`/sites/${site!.pays}/remplissages`, 'POST', {
    dossierId: dossier.id,
    page: page.page,
    remplis: resultat.remplis.length,
    manquants: plan.manquants.map((m) => m.cle),
  });

  $('resultat').innerHTML = '';
  ajouterLigne(
    `${resultat.remplis.length} champ(s) rempli(s) (encadrés en vert). ${plan.sautes} champ(s) facultatif(s) ou déjà rempli(s) laissé(s) de côté.`,
    'ok',
  );
  for (const m of plan.manquants)
    ajouterLigne(`À saisir : ${m.libelle} (${m.raison})`, 'manquant');
  for (const e of resultat.echecs)
    ajouterLigne(`Non rempli : ${e.cle} (${e.raison})`, 'manquant');
  if (plan.nonReleves.length)
    ajouterLigne(
      `${plan.nonReleves.length} champ(s) jamais relevé(s) sur cette page : cliquez « Relever les champs de cette page ».`,
      'manquant',
    );
}

function ajouterLigne(texte: string, classe: string) {
  const p = document.createElement('p');
  p.className = classe;
  p.textContent = texte;
  $('resultat').append(p);
}

// ─── Démarrage ───────────────────────────────────────────────────────────────

async function demarrer() {
  [onglet] = await chrome.tabs.query({ active: true, currentWindow: true });
  const hote = onglet?.url ? new URL(onglet.url).hostname : '';
  site = SITES[hote];
  $('site').textContent = site
    ? `Site : ${site.nom}`
    : "Ouvrez le formulaire officiel (COVA) dans l'onglet pour relever ou remplir une page.";
  $('actions-page').hidden = !site;
  if (!(await estConnecte())) {
    afficher('connexion');
    return;
  }
  afficher('principale');
  const moi = await appel<{ prenoms: string; nom: string }>('/auth/moi');
  $('utilisateur').textContent = `${moi.prenoms} ${moi.nom}`;
  await chargerDossiers();
}

let jetonCode = '';

$('form-connexion').addEventListener('submit', (e) => {
  e.preventDefault();
  const d = new FormData(e.target as HTMLFormElement);
  void tenter(async () => {
    const etape = await seConnecter(
      String(d.get('email')),
      String(d.get('motDePasse')),
    );
    if (etape) {
      jetonCode = etape.code;
      $('form-connexion').hidden = true;
      $('form-code').hidden = false;
      return;
    }
    await demarrer();
  });
});

$('form-code').addEventListener('submit', (e) => {
  e.preventDefault();
  const d = new FormData(e.target as HTMLFormElement);
  void tenter(async () => {
    await verifierCode(jetonCode, String(d.get('code')).trim());
    $('form-connexion').hidden = false;
    $('form-code').hidden = true;
    await demarrer();
  });
});

$('form-recherche').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = String(
    new FormData(e.target as HTMLFormElement).get('q') ?? '',
  ).trim();
  void tenter(() => chargerDossiers(q || undefined));
});

$<HTMLSelectElement>('dossier').addEventListener('change', (e) =>
  tenter(() => choisirDossier((e.target as HTMLSelectElement).value)),
);
$('relever').addEventListener('click', () => tenter(relever));
$('remplir').addEventListener('click', () => tenter(remplir));

$('form-numero').addEventListener('submit', (e) => {
  e.preventDefault();
  const numero = String(
    new FormData(e.target as HTMLFormElement).get('numero'),
  ).trim();
  void tenter(async () => {
    if (!dossier) throw new Error('Choisissez un dossier.');
    await envoyer(`/dossiers/${dossier.id}/statut`, 'POST', {
      statut: 'SOUMIS',
      numeroDemande: numero,
    });
    await choisirDossier(dossier.id);
    $('resultat').textContent = `Dossier marqué soumis (n° ${numero}).`;
  });
});

$('deconnexion').addEventListener('click', () =>
  tenter(async () => {
    await seDeconnecter();
    afficher('connexion');
    $('utilisateur').textContent = '';
  }),
);

$('bouton-parametres').addEventListener('click', () =>
  tenter(async () => {
    ($('form-parametres').querySelector('input') as HTMLInputElement).value =
      await adresseApi();
    afficher('parametres');
  }),
);
$('fermer-parametres').addEventListener('click', () => tenter(demarrer));
$('form-parametres').addEventListener('submit', (e) => {
  e.preventDefault();
  const adresse = String(new FormData(e.target as HTMLFormElement).get('api'));
  void tenter(async () => {
    await definirAdresseApi(adresse);
    await seDeconnecter();
    await demarrer();
  });
});

void tenter(demarrer);
