import type { DefinitionChamp, PaysAccueil } from '@/lib/types';
import { Champ, Liste, Saisie, Zone } from './ui';

const ORIGINES = {
  CAMPAGNE: 'Valeur commune de la campagne',
  MILITAIRE: 'Fiche du militaire (réutilisée par ses autres dossiers)',
  DOSSIER: '',
} as const;

/**
 * Champ d'un formulaire officiel, saisi en français sur la plateforme.
 * Le nom du champ HTML est l'identifiant du dictionnaire (`nom`, `passeportNumero`…).
 */
export function ChampDossier({
  champ,
  valeur,
  pays,
  origine,
  erreur,
  lectureSeule = false,
}: {
  champ: DefinitionChamp;
  valeur?: string;
  pays?: PaysAccueil;
  origine?: keyof typeof ORIGINES;
  erreur?: string;
  lectureSeule?: boolean;
}) {
  const obligatoire = pays ? champ.obligatoire.includes(pays) : false;
  const aide = [
    champ.aide,
    champ.latin ? 'Recopié en majuscules sans accent.' : undefined,
    origine ? ORIGINES[origine] : undefined,
  ]
    .filter(Boolean)
    .join(' ');
  const commun = {
    name: champ.id,
    defaultValue: valeur ?? '',
    disabled: lectureSeule,
    'aria-invalid': erreur ? true : undefined,
    className: erreur ? 'border-red-400' : undefined,
  };

  let saisie;
  switch (champ.type) {
    case 'texte_long':
      saisie = <Zone {...commun} rows={3} maxLength={4000} />;
      break;
    case 'date':
      saisie = <Saisie {...commun} type="date" />;
      break;
    case 'telephone':
      saisie = <Saisie {...commun} type="tel" placeholder="+224621123456" />;
      break;
    case 'email':
      saisie = <Saisie {...commun} type="email" />;
      break;
    case 'oui_non':
      saisie = (
        <Liste {...commun}>
          <option value="">—</option>
          <option value="NON">Non</option>
          <option value="OUI">Oui</option>
        </Liste>
      );
      break;
    case 'liste':
      saisie = (
        <Liste {...commun}>
          <option value="">—</option>
          {champ.options?.map((o) => (
            <option key={o.valeur} value={o.valeur}>
              {o.libelle}
            </option>
          ))}
        </Liste>
      );
      break;
    default:
      saisie = (
        <Saisie
          {...commun}
          maxLength={200}
          style={champ.latin ? { textTransform: 'uppercase' } : undefined}
        />
      );
  }
  return (
    <Champ
      libelle={champ.libelle}
      aide={aide || undefined}
      obligatoire={obligatoire}
    >
      {saisie}
      {erreur && <span className="text-xs text-red-700">{erreur}</span>}
    </Champ>
  );
}

export const CHAMP_INITIAL = '__valeurs_initiales';

/** Valeurs affichées à l'ouverture, pour n'envoyer ensuite que les champs modifiés. */
export function ValeursInitiales({
  valeurs,
}: {
  valeurs: Record<string, string>;
}) {
  return (
    <input type="hidden" name={CHAMP_INITIAL} value={JSON.stringify(valeurs)} />
  );
}

/**
 * Champs modifiés depuis l'ouverture du formulaire (vide → null : effacer).
 * Une valeur héritée de la campagne n'est ainsi jamais recopiée dans le dossier.
 */
export function lireModifications(
  donnees: FormData,
): Record<string, string | null> {
  let initiales: Record<string, string> = {};
  try {
    initiales = JSON.parse(
      String(donnees.get(CHAMP_INITIAL) ?? '{}'),
    ) as Record<string, string>;
  } catch {
    // Formulaire sans valeurs initiales : tout est envoyé.
  }
  const modifications: Record<string, string | null> = {};
  for (const [id, brut] of donnees.entries()) {
    if (id === CHAMP_INITIAL || id.startsWith('$') || typeof brut !== 'string')
      continue;
    const valeur = brut.trim();
    if (valeur !== (initiales[id] ?? '')) modifications[id] = valeur || null;
  }
  return modifications;
}
