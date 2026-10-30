/**
 * Lecture de la zone MRZ d'un passeport (format TD3 : deux lignes de 44
 * caractères, norme OACI 9303). Le texte vient d'un lecteur MRZ (qui se comporte
 * comme un clavier), d'une saisie ou d'une reconnaissance de caractères.
 */

export interface ResultatMrz {
  /** Vrai si les quatre sommes de contrôle sont justes. */
  valide: boolean;
  /** Les deux lignes après correction (à montrer à l'agent, et à renvoyer telles quelles). */
  lignes: [string, string];
  /** Caractères corrigés grâce aux chiffres de contrôle ou au remplissage « < ». */
  corrections: number;
  controles: {
    numero: boolean;
    naissance: boolean;
    expiration: boolean;
    global: boolean;
  };
  /** Valeurs pour les champs du dossier (même identifiants que referentiel/champs.ts). */
  champs: {
    nom: string;
    prenoms: string;
    passeportNumero: string;
    passeportPaysEmetteur: string;
    nationalite: string;
    dateNaissance: string | null;
    sexe: 'MASCULIN' | 'FEMININ' | null;
    passeportDateExpiration: string | null;
  };
}

const POIDS = [7, 3, 1];

const valeurCaractere = (c: string): number => {
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
  if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55;
  return 0; // « < »
};

/** Chiffre de contrôle OACI d'une portion de la MRZ. */
export function chiffreControle(portion: string): number {
  let somme = 0;
  for (let i = 0; i < portion.length; i++)
    somme += valeurCaractere(portion[i]) * POIDS[i % 3];
  return somme % 10;
}

/** Erreurs courantes de reconnaissance dans une zone qui ne contient que des chiffres. */
const versChiffres = (s: string) =>
  s
    .replace(/O|Q|D/g, '0')
    .replace(/I|L/g, '1')
    .replace(/Z/g, '2')
    .replace(/S/g, '5')
    .replace(/B/g, '8');

/**
 * Codes pays OACI les plus fréquents ici → libellé du formulaire
 * (les autres codes sont gardés tels quels).
 */
const NATIONALITES: Record<string, { pays: string; nationalite: string }> = {
  GIN: { pays: 'GUINEA', nationalite: 'GUINEAN' },
  CIV: { pays: "COTE D'IVOIRE", nationalite: 'IVORIAN' },
  SEN: { pays: 'SENEGAL', nationalite: 'SENEGALESE' },
  MLI: { pays: 'MALI', nationalite: 'MALIAN' },
  SLE: { pays: 'SIERRA LEONE', nationalite: 'SIERRA LEONEAN' },
  LBR: { pays: 'LIBERIA', nationalite: 'LIBERIAN' },
  FRA: { pays: 'FRANCE', nationalite: 'FRENCH' },
};

/** « 900315 » → « 1990-03-15 ». `siecle` : naissance (passé) ou expiration (futur). */
function dateMrz(
  aammjj: string,
  type: 'naissance' | 'expiration',
  aujourdhui: Date,
): string | null {
  if (!/^\d{6}$/.test(aammjj)) return null;
  const aa = Number(aammjj.slice(0, 2));
  const mm = aammjj.slice(2, 4);
  const jj = aammjj.slice(4, 6);
  const anneeCourante = aujourdhui.getUTCFullYear() % 100;
  const siecle =
    type === 'naissance'
      ? aa > anneeCourante
        ? 1900
        : 2000
      : aa < anneeCourante - 50
        ? 2100
        : 2000;
  const iso = `${siecle + aa}-${mm}-${jj}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(iso)
    ? iso
    : null;
}

/**
 * Ligne de longueur fausse (reconnaissance de caractères : un « < » perdu ou
 * en trop dans un remplissage) : la zone de remplissage absorbe l'écart.
 * Ligne 2 : le début (0-27) et les deux chiffres de fin restent à leur place.
 */
function ajuster(ligne: string, numero: 1 | 2): string {
  if (ligne.length === 44 || numero === 1 || ligne.length < 30)
    return ligne.slice(0, 44).padEnd(44, '<');
  let perso = ligne.slice(28, -2);
  while (perso.length > 14 && perso.endsWith('<')) perso = perso.slice(0, -1);
  perso = perso.slice(0, 14).padEnd(14, '<');
  return ligne.slice(0, 28) + perso + ligne.slice(-2);
}

/**
 * Garde les deux lignes de la MRZ dans un texte (espaces, lignes parasites,
 * minuscules). Une ligne 1 lue sans son « P » initial (« <GINDIALLO… ») ou
 * raccourcie (remplissage perdu) est acceptée : la ligne 2 est contrôlée.
 */
export function extraireLignes(texte: string): [string, string] | null {
  const brutes = trouverLignes(texte);
  return brutes ? [ajuster(brutes[0], 1), ajuster(brutes[1], 2)] : null;
}

/** Les deux lignes telles que lues, avant mise à 44 caractères. */
function trouverLignes(texte: string): [string, string] | null {
  const lignes = texte
    .toUpperCase()
    .split(/\r?\n/)
    .map((l) => l.replace(/[\s«]/g, '').replace(/[^A-Z0-9<]/g, '<'))
    .filter((l) => l.length >= 30);
  const debut = lignes.findIndex(
    (l) => l.startsWith('P') || /^<[A-Z]{3}[A-Z]/.test(l),
  );
  if (debut === -1 || !lignes[debut + 1] || lignes[debut + 1].length < 40)
    return null;
  const l1 = lignes[debut].startsWith('<')
    ? `P${lignes[debut]}`
    : lignes[debut];
  return [l1, lignes[debut + 1]];
}

/**
 * Fin de la ligne 1 : le remplissage « <<<< » est souvent lu « LLLL » ou
 * « KKKK ». Une suite d'au moins 3 de ces lettres en fin de ligne redevient
 * du remplissage (aucun nom ne s'écrit ainsi) ; les noms, sans chiffre de
 * contrôle, restent à vérifier par l'agent.
 */
function nettoyerLigne1(l: string): { ligne: string; corrections: number } {
  let corrections = 0;
  const remplissage = (m: string) => {
    corrections += m.length;
    return '<'.repeat(m.length);
  };
  // « CAMARA<K<MOUSSA » : le séparateur « << » lu « <K< » (une lettre K, L
  // ou C seule entre deux « < » n'est pas un nom).
  let noms = l.slice(5).replace(/(?<=<)[KLC](?=<)/g, remplissage);
  // Un ou deux caractères parasites au bout d'un long remplissage (« …LLLLS »).
  noms = noms.replace(/(?<=[<KLC]{10})[A-Z0-9]{1,2}(?=<*$)/, remplissage);
  const fin = /[<KLC]+$/.exec(noms);
  if (fin)
    noms =
      noms.slice(0, fin.index) +
      fin[0].replace(/(?<=^|<)[KLC]{3,}|[KLC]{3,}(?=<|$)/g, remplissage);
  return { ligne: l.slice(0, 5) + noms, corrections };
}

/** Caractères qui se confondent à la lecture (zones lettres et chiffres). */
const SOSIES = ['0OQD', '1I', '2Z', '5S', '8B', '6G', '<KL'];

/**
 * Corrige une zone alphanumérique (numéro du passeport, zone personnelle) :
 * un seul caractère, remplacé par son sosie, et seulement si une seule
 * variante satisfait `accepte` (chiffre de la zone ET chiffre global). Dans
 * le doute, la zone reste telle quelle et l'agent relit : mieux vaut un refus
 * qu'un numéro faux qui passerait les contrôles.
 */
export function corrigerZone(
  zone: string,
  accepte: (zone: string) => boolean,
): string {
  if (accepte(zone)) return zone;
  const trouvees = new Set<string>();
  for (let i = 0; i < zone.length; i++)
    for (const c of SOSIES.find((g) => g.includes(zone[i])) ?? '') {
      const variante = zone.slice(0, i) + c + zone.slice(i + 1);
      if (c !== zone[i] && accepte(variante)) trouvees.add(variante);
    }
  return trouvees.size === 1 ? [...trouvees][0] : zone;
}

export function lireMrz(
  texte: string,
  aujourdhui: Date = new Date(),
): ResultatMrz | null {
  const brutes = trouverLignes(texte);
  if (!brutes) return null;
  const [b1, b2] = brutes;
  const resultat = analyserLignes(ajuster(b1, 1), ajuster(b2, 2), aujourdhui);
  if (resultat.valide || b2.length < 40) return resultat;
  // Un caractère en trop avant la zone personnelle (« GIN00001018 »), avec
  // ou sans « < » perdus dans le remplissage, décale tout : chacun est retiré
  // à son tour, et la ligne n'est gardée que si une seule version passe les
  // quatre contrôles.
  const valides = new Map<string, ResultatMrz>();
  for (let i = 0; i < 28; i++) {
    const r = analyserLignes(
      ajuster(b1, 1),
      ajuster(b2.slice(0, i) + b2.slice(i + 1), 2),
      aujourdhui,
    );
    // La nationalité (lettres) et le sexe n'ont pas de chiffre de contrôle :
    // leur forme est vérifiée.
    if (r.valide && /^.{10}[A-Z<]{3}.{7}[MFX<]/.test(r.lignes[1]))
      valides.set(r.lignes[1], r);
  }
  // Plusieurs versions : celle dont la nationalité est le pays émetteur de
  // la ligne 1 (« GIN » plutôt que « INO »), si elle est seule dans ce cas.
  let candidates = [...valides.values()];
  if (candidates.length > 1) {
    const emetteur = ajuster(b1, 1).slice(2, 5);
    candidates = candidates.filter(
      (r) => r.lignes[1].slice(10, 13) === emetteur,
    );
  }
  const [seule] = candidates;
  return candidates.length === 1
    ? { ...seule, corrections: seule.corrections + 1 }
    : resultat;
}

function analyserLignes(
  brute1: string,
  brute2: string,
  aujourdhui: Date,
): ResultatMrz {
  const nettoyee = nettoyerLigne1(brute1);
  const l1 = nettoyee.ligne;

  // Ligne 2 : positions numériques corrigées, puis zones alphanumériques
  // d'après leur chiffre de contrôle.
  const chiffres =
    brute2.slice(0, 9) +
    versChiffres(brute2[9]) +
    brute2.slice(10, 13) +
    versChiffres(brute2.slice(13, 20)) +
    brute2[20] +
    versChiffres(brute2.slice(21, 28)) +
    brute2.slice(28, 42) +
    versChiffres(brute2.slice(42, 44));
  const juste = (portion: string, chiffre: string) =>
    String(chiffreControle(portion)) === chiffre;
  const globalJuste = (l: string) =>
    juste(l.slice(0, 10) + l.slice(13, 20) + l.slice(21, 43), l[43]);
  let l2 = chiffres;
  const numeroCorrige = corrigerZone(
    l2.slice(0, 9),
    (z) => juste(z, l2[9]) && globalJuste(z + l2.slice(9)),
  );
  l2 = numeroCorrige + l2.slice(9);
  // Zone personnelle vide : son chiffre de contrôle peut être « < » ou « 0 ».
  const persoJuste = (z: string) =>
    (l2[42] === '<' ? /^<+$/.test(z) : juste(z, l2[42])) &&
    globalJuste(l2.slice(0, 28) + z + l2.slice(42));
  // Remplissage lu « <<<<K<K<<< » : K vaut 20 et compte comme « < » dans les
  // chiffres de contrôle, qui ne voient pas l'erreur. Une zone sans chiffre,
  // faite surtout de « < », redevient vide si les contrôles le confirment.
  const perso = l2.slice(28, 42);
  const vide = '<'.repeat(14);
  const persoCorrige =
    /^[<KLC]+$/.test(perso) && perso.split('<').length > 8 && persoJuste(vide)
      ? vide
      : corrigerZone(perso, persoJuste);
  l2 = l2.slice(0, 28) + persoCorrige + l2.slice(42);
  const corrections =
    nettoyee.corrections + [...brute2].filter((c, i) => c !== l2[i]).length;

  const numero = l2.slice(0, 9);
  const naissance = l2.slice(13, 19);
  const expiration = l2.slice(21, 27);
  const controles = {
    numero: juste(numero, l2[9]),
    naissance: juste(naissance, l2[19]),
    expiration: juste(expiration, l2[27]),
    global: globalJuste(l2),
  };

  const [nom, prenoms = ''] = l1.slice(5).split('<<');
  const texteNom = (s: string) => s.replace(/<+/g, ' ').trim();
  const emetteur = l1.slice(2, 5).replace(/</g, '');
  const nationalite = l2.slice(10, 13).replace(/</g, '');
  const sexe = l2[20];

  return {
    valide: Object.values(controles).every(Boolean),
    lignes: [l1, l2],
    corrections,
    controles,
    champs: {
      nom: texteNom(nom),
      prenoms: texteNom(prenoms),
      passeportNumero: numero.replace(/</g, ''),
      passeportPaysEmetteur: NATIONALITES[emetteur]?.pays ?? emetteur,
      nationalite: NATIONALITES[nationalite]?.nationalite ?? nationalite,
      dateNaissance: dateMrz(naissance, 'naissance', aujourdhui),
      sexe: sexe === 'M' ? 'MASCULIN' : sexe === 'F' ? 'FEMININ' : null,
      passeportDateExpiration: dateMrz(expiration, 'expiration', aujourdhui),
    },
  };
}
