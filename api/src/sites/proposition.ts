import { CHAMPS_PAR_ID } from '../referentiel/champs.js';

/**
 * Propositions automatiques de correspondance, d'après le libellé d'un champ
 * relevé sur le site officiel (affiché en français, en anglais, en chinois ou
 * en russe). Ce ne sont que des propositions : un gestionnaire les confirme.
 */

/** « Date de naissance : » → « date de naissance » (minuscules, sans accent ni ponctuation finale). */
export const normaliserLibelle = (texte: string): string =>
  texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
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
      'numero de passeport',
      'n° du passeport',
      'n° de passeport',
      'passport no',
      'passport number',
      '护照号码',
      '护照号',
      'номер паспорта',
      'серия и номер',
    ],
  ],
  [
    'passeportDateExpiration',
    [
      "date d'expiration",
      'valable jusqu',
      'date of expiry',
      'expiration date',
      'expiry date',
      'valid until',
      '有效期至',
      '失效日期',
      'действителен до',
      'срок действия',
    ],
  ],
  [
    'passeportDateDelivrance',
    [
      'date de delivrance',
      'delivre le',
      'date of issue',
      'issue date',
      '签发日期',
      'дата выдачи',
    ],
  ],
  [
    'passeportLieuDelivrance',
    ['lieu de delivrance', 'place of issue', '签发地', 'место выдачи'],
  ],
  [
    'passeportPaysEmetteur',
    [
      'pays emetteur',
      'pays de delivrance',
      'issuing country',
      'country of issue',
      '签发国',
      'страна выдачи',
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
      'тип паспорта',
      'вид паспорта',
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
  ['pereNomComplet', ['nom du pere', "father's name", '父亲姓名', 'отец']],
  ['mereNomComplet', ['nom de la mere', "mother's name", '母亲姓名', 'мать']],
  [
    'urgenceNomComplet',
    ["contact en cas d'urgence", 'emergency contact', '紧急联系人'],
  ],
  // Identité
  [
    'autresNoms',
    [
      'autres noms',
      'ancien nom',
      'other names',
      'former name',
      '曾用名',
      'прежняя фамилия',
      'другие фамилии',
    ],
  ],
  ['prenoms', ['prenom', 'given name', 'first name', '名', 'имя']],
  [
    'nom',
    ['nom de famille', 'surname', 'family name', 'last name', '姓', 'фамилия'],
  ],
  [
    'dateNaissance',
    [
      'date de naissance',
      'date of birth',
      'birth date',
      '出生日期',
      'дата рождения',
    ],
  ],
  [
    'lieuNaissancePays',
    ['pays de naissance', 'country of birth', '出生国', 'страна рождения'],
  ],
  [
    'lieuNaissanceVille',
    [
      'lieu de naissance',
      'ville de naissance',
      'place of birth',
      'city of birth',
      '出生地',
      'место рождения',
    ],
  ],
  ['sexe', ['sexe', 'gender', 'sex', '性别', 'пол']],
  [
    'autreNationalite',
    [
      'autre nationalite',
      'autre citoyennete',
      'other nationality',
      'other citizenship',
      '其他国籍',
      'другое гражданство',
    ],
  ],
  [
    'nationalite',
    [
      'nationalite',
      'citoyennete',
      'nationality',
      'citizenship',
      '国籍',
      'гражданство',
    ],
  ],
  [
    'numeroIdentite',
    ["carte d'identite", 'identity card', 'id card', 'id number', '身份证'],
  ],
  [
    'situationFamiliale',
    [
      'situation familiale',
      'etat civil',
      'marital status',
      '婚姻状况',
      'семейное положение',
    ],
  ],
  // Contacts (courriel avant adresse)
  [
    'email',
    [
      'e-mail',
      'email',
      'courriel',
      'adresse electronique',
      '电子邮箱',
      '邮箱',
      'электронная почта',
      'электронной почты',
    ],
  ],
  ['telephone', ['telephone', 'mobile', 'phone', '电话', '手机', 'телефон']],
  // Séjour : invitation et établissement d'accueil (avant « adresse », « date »)
  [
    'numeroInvitation',
    [
      "numero de l'invitation",
      "numero d'invitation",
      "n° de l'invitation",
      'invitation number',
      'number of invitation',
      'номер приглашения',
    ],
  ],
  [
    'dateInvitation',
    [
      "date de l'invitation",
      "date d'invitation",
      'invitation date',
      'date of invitation',
      'дата приглашения',
    ],
  ],
  [
    'etablissementAdresse',
    [
      "adresse de l'organisation",
      "adresse de l'etablissement",
      'address of the inviting',
      'адрес принимающей',
    ],
  ],
  [
    'adresseSejour',
    [
      'adresse en chine',
      'adresse en russie',
      'adresse pendant le sejour',
      'address in china',
      'address in russia',
      '在华地址',
      'адрес в россии',
    ],
  ],
  [
    'adresse',
    [
      'adresse du domicile',
      'home address',
      'adresse',
      'address',
      '住址',
      'адрес',
    ],
  ],
  ['ville', ['ville', 'city', '城市', 'город']],
  // Profession, études
  [
    'employeur',
    [
      'employeur',
      'employer',
      'nom de l’entreprise',
      'lieu de travail',
      'place of work',
      'work unit',
      '工作单位',
      'место работы',
    ],
  ],
  [
    'fonction',
    ['fonction', 'poste', 'position', 'job title', '职务', 'должность'],
  ],
  [
    'profession',
    ['profession', 'occupation', '职业', 'профессия', 'род занятий'],
  ],
  ['dernierDiplome', ['diplome', 'degree', 'education', '学历', 'образование']],
  // Séjour
  [
    'objetSejour',
    [
      'objet du voyage',
      'but du voyage',
      'objet de la visite',
      'but de la visite',
      'purpose of',
      'цель поездки',
      'цель визита',
    ],
  ],
  [
    'dateArrivee',
    [
      "date d'arrivee",
      "date d'entree",
      'date of arrival',
      'arrival date',
      'entry date',
      'date of entry',
      '入境日期',
      '抵达日期',
      'дата въезда',
    ],
  ],
  [
    'dateFinSejour',
    [
      'date de depart',
      'date de sortie',
      'date of departure',
      'departure date',
      'date of exit',
      'exit date',
      '离境日期',
      'дата выезда',
    ],
  ],
  [
    'villeEntree',
    [
      "ville d'entree",
      "port d'entree",
      "point d'entree",
      'city of entry',
      'port of entry',
      'point of entry',
      '入境口岸',
      'пункт въезда',
    ],
  ],
  [
    'etablissementAccueil',
    [
      'organisation invitante',
      "organisation d'accueil",
      'inviting organization',
      'host organization',
      'etablissement',
      'universite',
      'ecole',
      'university',
      'school',
      'institution',
      '学校',
      '院校',
      'принимающая организация',
      'приглашающая организация',
      'университет',
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
    'assuranceNumero',
    [
      "police d'assurance",
      'numero de police',
      'insurance policy',
      'policy number',
      'страховой полис',
      'номер полиса',
    ],
  ],
  [
    'assuranceCompagnie',
    [
      "compagnie d'assurance",
      'assureur',
      'insurance company',
      'страховая компания',
    ],
  ],
  [
    'financement',
    ['financement', 'qui paie', 'expenses', 'who will pay', '费用', 'расходы'],
  ],
  [
    'refusVisa',
    [
      'refus de visa',
      'visa refused',
      'refused a visa',
      '拒签',
      'отказ в визе',
      'отказывали',
    ],
  ],
  [
    'antecedentsJudiciaires',
    [
      'casier judiciaire',
      'condamnation',
      'criminal record',
      'convicted',
      '犯罪',
      'судим',
    ],
  ],
  ['maladieGrave', ['maladie', 'disease', 'illness', '疾病', 'заболевани']],
  [
    'serviceMilitaire',
    [
      'service militaire',
      'forces armees',
      'military service',
      'served in the military',
      '服兵役',
      '军',
      'военная служба',
      'военной службы',
    ],
  ],
];

/** Idéogrammes seuls : comparaison exacte seulement. */
const COURTS = new Set(['名', '姓', '军']);
/** Mots courts (« пол » dans « полный ») : mot entier seulement. */
const MOTS = new Set(['пол', 'имя']);

/** Champ du dictionnaire probablement demandé par ce libellé, ou null. */
export function proposerChamp(libelle: string): string | null {
  const texte = normaliserLibelle(libelle);
  if (!texte) return null;
  const mots = texte.split(/[^\p{L}]+/u);
  for (const [champId, motifs] of REGLES)
    for (const motif of motifs) {
      const m = normaliserLibelle(motif);
      if (
        COURTS.has(m)
          ? texte === m
          : MOTS.has(m)
            ? mots.includes(m)
            : texte.includes(m)
      )
        return champId;
    }
  return null;
}

export interface OptionSite {
  valeur: string;
  libelle: string;
}

/** Libellés équivalents des choix du dictionnaire (pour reconnaître ceux du site). */
const SYNONYMES: Record<string, string[]> = {
  MASCULIN: ['masculin', 'homme', 'male', 'man', 'm', '男', 'мужской', 'муж'],
  FEMININ: ['feminin', 'femme', 'female', 'woman', 'f', '女', 'женский', 'жен'],
  OUI: ['oui', 'yes', 'y', '是', '有', 'да'],
  NON: ['non', 'no', 'n', '否', '无', '没有', 'нет'],
  CELIBATAIRE: [
    'celibataire',
    'single',
    'unmarried',
    '未婚',
    'холост',
    'не замужем',
    'не женат',
  ],
  MARIE: ['marie', 'mariee', 'married', '已婚', 'женат', 'замужем'],
  DIVORCE: ['divorce', 'divorcee', 'divorced', '离异', '离婚', 'разведен'],
  VEUF: ['veuf', 'veuve', 'widowed', '丧偶', 'вдовец', 'вдова'],
  ORDINAIRE: ['ordinaire', 'ordinary', 'regular', '普通', 'обычныи'],
  SERVICE: ['service', 'de service', 'official', '公务', 'служебныи'],
  DIPLOMATIQUE: ['diplomatique', 'diplomatic', '外交', 'дипломатическии'],
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
