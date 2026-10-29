import { CHAMPS_PAR_ID } from '../referentiel/champs.js';

/**
 * Propositions automatiques de correspondance, d'après le libellé d'un champ
 * relevé sur le site officiel (affiché en français, en anglais ou en chinois).
 * Ce ne sont que des propositions : un gestionnaire les confirme.
 */

/** « Date de naissance : » → « date de naissance » (minuscules, sans accent ni ponctuation finale). */
export const normaliserLibelle = (texte: string): string =>
  texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[*:：]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Règles, de la plus précise à la plus générale : le premier motif trouvé
 * dans le libellé désigne le champ du dictionnaire.
 */
const REGLES: [champId: string, motifs: string[]][] = [
  // Passeport (avant « nom », « date »…)
  [
    'passeportNumero',
    [
      'numero du passeport',
      'passport no',
      'passport number',
      '护照号码',
      '护照号',
    ],
  ],
  [
    'passeportDateExpiration',
    [
      "date d'expiration",
      'date of expiry',
      'expiration date',
      'expiry date',
      '有效期至',
      '失效日期',
    ],
  ],
  [
    'passeportDateDelivrance',
    ['date de delivrance', 'date of issue', 'issue date', '签发日期'],
  ],
  [
    'passeportLieuDelivrance',
    ['lieu de delivrance', 'place of issue', '签发地'],
  ],
  [
    'passeportPaysEmetteur',
    [
      'pays emetteur',
      'pays de delivrance',
      'issuing country',
      'country of issue',
      '签发国',
    ],
  ],
  [
    'passeportType',
    [
      'type de passeport',
      'passport type',
      'type of passport',
      '护照种类',
      '护照类型',
    ],
  ],
  // Famille (avant « nom »)
  [
    'conjointNom',
    ['nom du conjoint', "spouse's family name", 'spouse surname', '配偶姓'],
  ],
  ['conjointPrenoms', ['prenom du conjoint', "spouse's given name", '配偶名']],
  [
    'conjointDateNaissance',
    ['date de naissance du conjoint', "spouse's date of birth", '配偶出生日期'],
  ],
  ['pereNomComplet', ['nom du pere', "father's name", '父亲姓名']],
  ['mereNomComplet', ['nom de la mere', "mother's name", '母亲姓名']],
  [
    'urgenceNomComplet',
    ["contact en cas d'urgence", 'emergency contact', '紧急联系人'],
  ],
  // Identité
  [
    'autresNoms',
    ['autres noms', 'ancien nom', 'other names', 'former name', '曾用名'],
  ],
  ['prenoms', ['prenom', 'given name', 'first name', '名']],
  ['nom', ['nom de famille', 'surname', 'family name', 'last name', '姓']],
  [
    'dateNaissance',
    ['date de naissance', 'date of birth', 'birth date', '出生日期'],
  ],
  ['lieuNaissancePays', ['pays de naissance', 'country of birth', '出生国']],
  [
    'lieuNaissanceVille',
    [
      'lieu de naissance',
      'ville de naissance',
      'place of birth',
      'city of birth',
      '出生地',
    ],
  ],
  ['sexe', ['sexe', 'gender', 'sex', '性别']],
  ['autreNationalite', ['autre nationalite', 'other nationality', '其他国籍']],
  ['nationalite', ['nationalite', 'nationality', '国籍']],
  [
    'numeroIdentite',
    ["carte d'identite", 'identity card', 'id card', 'id number', '身份证'],
  ],
  [
    'situationFamiliale',
    ['situation familiale', 'etat civil', 'marital status', '婚姻状况'],
  ],
  // Contacts
  ['email', ['e-mail', 'email', 'courriel', '电子邮箱', '邮箱']],
  ['telephone', ['telephone', 'mobile', 'phone', '电话', '手机']],
  [
    'adresse',
    ['adresse du domicile', 'home address', 'adresse', 'address', '住址'],
  ],
  ['ville', ['ville', 'city', '城市']],
  // Profession, études
  [
    'employeur',
    ['employeur', 'employer', 'nom de l’entreprise', 'work unit', '工作单位'],
  ],
  ['fonction', ['fonction', 'poste', 'position', 'job title', '职务']],
  ['profession', ['profession', 'occupation', '职业']],
  ['dernierDiplome', ['diplome', 'degree', 'education', '学历']],
  // Séjour
  [
    'dateArrivee',
    [
      "date d'arrivee",
      "date d'entree",
      'date of arrival',
      'arrival date',
      'entry date',
      '入境日期',
      '抵达日期',
    ],
  ],
  [
    'dateFinSejour',
    ['date de depart', 'date of departure', 'departure date', '离境日期'],
  ],
  [
    'villeEntree',
    [
      "ville d'entree",
      "port d'entree",
      'city of entry',
      'port of entry',
      '入境口岸',
    ],
  ],
  [
    'etablissementAccueil',
    [
      'etablissement',
      'universite',
      'ecole',
      'university',
      'school',
      'institution',
      '学校',
      '院校',
    ],
  ],
  [
    'adresseSejour',
    [
      'adresse en chine',
      'adresse pendant le sejour',
      'address in china',
      '在华地址',
    ],
  ],
  ['numeroJW', ['jw201', 'jw202', 'jw 201', 'jw 202']],
  [
    'numeroAdmission',
    [
      "lettre d'admission",
      'admission notice',
      'admission letter',
      '录取通知书',
    ],
  ],
  [
    'financement',
    ['financement', 'qui paie', 'expenses', 'who will pay', '费用'],
  ],
  ['refusVisa', ['refus de visa', 'visa refused', 'refused a visa', '拒签']],
  [
    'antecedentsJudiciaires',
    [
      'casier judiciaire',
      'condamnation',
      'criminal record',
      'convicted',
      '犯罪',
    ],
  ],
  ['maladieGrave', ['maladie', 'disease', 'illness', '疾病']],
  [
    'serviceMilitaire',
    [
      'service militaire',
      'forces armees',
      'military service',
      'served in the military',
      '服兵役',
      '军',
    ],
  ],
];

/** Mots composés d'une seule lettre ou d'un idéogramme : comparaison exacte seulement. */
const COURTS = new Set(['名', '姓', '军']);

/** Champ du dictionnaire probablement demandé par ce libellé, ou null. */
export function proposerChamp(libelle: string): string | null {
  const texte = normaliserLibelle(libelle);
  if (!texte) return null;
  for (const [champId, motifs] of REGLES)
    for (const motif of motifs) {
      const m = normaliserLibelle(motif);
      if (COURTS.has(m) ? texte === m : texte.includes(m)) return champId;
    }
  return null;
}

export interface OptionSite {
  valeur: string;
  libelle: string;
}

/** Libellés équivalents des choix du dictionnaire (pour reconnaître ceux du site). */
const SYNONYMES: Record<string, string[]> = {
  MASCULIN: ['masculin', 'homme', 'male', 'man', 'm', '男'],
  FEMININ: ['feminin', 'femme', 'female', 'woman', 'f', '女'],
  OUI: ['oui', 'yes', 'y', '是', '有'],
  NON: ['non', 'no', 'n', '否', '无', '没有'],
  CELIBATAIRE: ['celibataire', 'single', 'unmarried', '未婚'],
  MARIE: ['marie', 'mariee', 'married', '已婚'],
  DIVORCE: ['divorce', 'divorcee', 'divorced', '离异', '离婚'],
  VEUF: ['veuf', 'veuve', 'widowed', '丧偶'],
  ORDINAIRE: ['ordinaire', 'ordinary', 'regular', '普通'],
  SERVICE: ['service', 'de service', 'official', '公务'],
  DIPLOMATIQUE: ['diplomatique', 'diplomatic', '外交'],
};

/**
 * Conversions proposées : pour chaque choix du dictionnaire (ou oui/non), le
 * choix du site dont le libellé lui correspond.
 */
export function proposerConversions(
  champId: string | null,
  options: OptionSite[],
): Record<string, string> {
  if (!champId || !options.length) return {};
  const champ = CHAMPS_PAR_ID.get(champId);
  const valeurs =
    champ?.type === 'oui_non'
      ? ['OUI', 'NON']
      : (champ?.options?.map((o) => o.valeur) ?? []);
  const conversions: Record<string, string> = {};
  for (const valeur of valeurs) {
    const libelles = [
      valeur,
      ...(SYNONYMES[valeur] ?? []),
      champ?.options?.find((o) => o.valeur === valeur)?.libelle ?? '',
    ]
      .map(normaliserLibelle)
      .filter(Boolean);
    const trouvee = options.find((o) =>
      libelles.includes(normaliserLibelle(o.libelle)),
    );
    if (trouvee) conversions[valeur] = trouvee.valeur;
  }
  return conversions;
}
