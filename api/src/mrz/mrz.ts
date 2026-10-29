/**
 * Lecture de la zone MRZ d'un passeport (format TD3 : deux lignes de 44
 * caractères, norme OACI 9303). Le texte vient d'un lecteur MRZ (qui se comporte
 * comme un clavier), d'une saisie ou d'une reconnaissance de caractères.
 */

export interface ResultatMrz {
  /** Vrai si les quatre sommes de contrôle sont justes. */
  valide: boolean;
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

/** Garde les deux lignes de la MRZ dans un texte (espaces, lignes parasites, minuscules). */
export function extraireLignes(texte: string): [string, string] | null {
  const lignes = texte
    .toUpperCase()
    .split(/\r?\n/)
    .map((l) => l.replace(/[\s«]/g, '').replace(/[^A-Z0-9<]/g, '<'))
    .filter((l) => l.length >= 40);
  const debut = lignes.findIndex((l) => l.startsWith('P'));
  if (debut === -1 || !lignes[debut + 1]) return null;
  const ajuster = (l: string) => l.slice(0, 44).padEnd(44, '<');
  return [ajuster(lignes[debut]), ajuster(lignes[debut + 1])];
}

export function lireMrz(
  texte: string,
  aujourdhui: Date = new Date(),
): ResultatMrz | null {
  const lignes = extraireLignes(texte);
  if (!lignes) return null;
  const [l1, brute2] = lignes;

  // Ligne 2 : seules les positions numériques sont corrigées.
  const l2 =
    brute2.slice(0, 9) +
    versChiffres(brute2[9]) +
    brute2.slice(10, 13) +
    versChiffres(brute2.slice(13, 20)) +
    brute2[20] +
    versChiffres(brute2.slice(21, 28)) +
    brute2.slice(28, 42) +
    versChiffres(brute2.slice(42, 44));

  const numero = l2.slice(0, 9);
  const naissance = l2.slice(13, 19);
  const expiration = l2.slice(21, 27);
  const controle = (portion: string, chiffre: string) =>
    String(chiffreControle(portion)) === chiffre;
  const controles = {
    numero: controle(numero, l2[9]),
    naissance: controle(naissance, l2[19]),
    expiration: controle(expiration, l2[27]),
    global: controle(
      l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43),
      l2[43],
    ),
  };

  const [nom, prenoms = ''] = l1.slice(5).split('<<');
  const texteNom = (s: string) => s.replace(/<+/g, ' ').trim();
  const emetteur = l1.slice(2, 5).replace(/</g, '');
  const nationalite = l2.slice(10, 13).replace(/</g, '');
  const sexe = l2[20];

  return {
    valide: Object.values(controles).every(Boolean),
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
