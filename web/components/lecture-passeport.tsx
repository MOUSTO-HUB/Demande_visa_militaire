'use client';

import { useEffect, useRef, useState } from 'react';
import { arreterMoteur, lireMrzSurPhoto } from '@/lib/ocr-passeport';
import type { EtatFormulaire } from '@/lib/api';
import type { ResultatMrz } from '@/lib/types';
import { FormulaireAction } from './formulaire-action';
import { Alerte, Champ, styles, Zone } from './ui';

type Analyse = (
  texte: string,
) => Promise<{ resultat?: ResultatMrz; erreur?: string }>;

/** Lignes qui peuvent être celles de la MRZ (au moins 30 caractères sans espace). */
const candidates = (texte: string) =>
  texte
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ''))
    .filter((l) => l.length >= 30)
    .join('\n');

const justes = (r: ResultatMrz) =>
  Object.values(r.controles).filter(Boolean).length;

const LIBELLES_CONTROLE: Record<keyof ResultatMrz['controles'], string> = {
  numero: 'numéro du passeport',
  naissance: 'date de naissance',
  expiration: "date d'expiration",
  global: 'contrôle global',
};

const dateFr = (iso: string | null) =>
  iso ? iso.split('-').reverse().join('/') : '—';

/**
 * Lecture du passeport : photo (lue dans le navigateur), lecteur MRZ ou
 * saisie des deux lignes. L'agent vérifie l'aperçu puis enregistre.
 */
export function LecturePasseport({
  action,
  analyser,
  connus,
}: {
  action: (
    etat: EtatFormulaire | null,
    donnees: FormData,
  ) => Promise<EtatFormulaire | null>;
  analyser: Analyse;
  /** Nom et prénoms déjà dans le dossier (liste de la DGRECM), pour comparaison. */
  connus?: { nom?: string; prenoms?: string };
}) {
  const zone = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<ResultatMrz | null>(null);
  const [introuvable, setIntrouvable] = useState(false);

  // Le moteur (plusieurs Mo en mémoire) est libéré en quittant la page.
  useEffect(() => () => void arreterMoteur(), []);

  async function lirePhoto(fichier: File) {
    setEnCours(true);
    setResultat(null);
    setIntrouvable(false);
    if (zone.current) zone.current.value = '';
    let meilleur: ResultatMrz | null = null;
    try {
      await lireMrzSurPhoto(
        fichier,
        async (texte) => {
          const lignes = candidates(texte);
          if (lignes.length < 80) return false;
          const { resultat: r } = await analyser(lignes);
          if (r && (!meilleur || justes(r) > justes(meilleur))) meilleur = r;
          return !!r?.valide;
        },
        setMessage,
      );
      const trouve = meilleur as ResultatMrz | null;
      if (trouve && zone.current) zone.current.value = trouve.lignes.join('\n');
      setResultat(trouve);
      setIntrouvable(!trouve);
    } catch (e) {
      setMessage(
        `La lecture de la photo a échoué : ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    } finally {
      setEnCours(false);
    }
    setMessage(null);
  }

  const fausses = resultat
    ? (
        Object.keys(LIBELLES_CONTROLE) as (keyof ResultatMrz['controles'])[]
      ).filter((c) => !resultat.controles[c])
    : [];

  // Les noms n'ont pas de chiffre de contrôle : un écart avec la liste de la
  // DGRECM est signalé (le passeport fait foi, rien n'est remplacé).
  const simplifier = (s?: string) =>
    (s ?? '')
      .normalize('NFD')
      .replace(/[^A-Za-z]+/g, ' ')
      .trim()
      .toUpperCase();
  const ecartsNoms = resultat
    ? (['nom', 'prenoms'] as const).filter(
        (c) =>
          connus?.[c] &&
          simplifier(connus[c]) !== simplifier(resultat.champs[c]),
      )
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={`${styles.boutonSecondaire} cursor-pointer ${enCours ? 'pointer-events-none opacity-60' : ''}`}
        >
          📷 Photo ou scan du passeport
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={enCours}
            onChange={(e) => {
              const fichier = e.target.files?.[0];
              e.target.value = '';
              if (fichier) void lirePhoto(fichier);
            }}
          />
        </label>
        <span className="text-xs text-slate-500">
          La photo est lue sur ce poste : elle n’est ni envoyée ni conservée.
        </span>
      </div>

      {message && (
        <p className="text-sm text-marque-800" role="status">
          {message}
        </p>
      )}

      {introuvable && (
        <Alerte>
          MRZ introuvable sur cette photo. Reprenez-la à plat, bien éclairée et
          sans reflet, la page d’identité entière dans le cadre ; ou passez le
          passeport au lecteur MRZ, ou recopiez les deux lignes.
        </Alerte>
      )}

      {resultat && (
        <div className="flex flex-col gap-2">
          {resultat.valide ? (
            <Alerte type="succes">
              Les chiffres de contrôle sont justes
              {resultat.corrections > 0 &&
                ' (des caractères mal lus ont été corrigés)'}
              . Comparez le nom et les prénoms avec le passeport (ils n’ont pas
              de chiffre de contrôle), puis cliquez « Lire et remplir ».
            </Alerte>
          ) : (
            <Alerte>
              Lecture incomplète :{' '}
              {fausses.map((c) => LIBELLES_CONTROLE[c]).join(', ')}{' '}
              {fausses.length > 1 ? 'ne correspondent' : 'ne correspond'} pas.
              Corrigez les caractères dans la zone ci-dessous en comparant avec
              le passeport (0 et O, 1 et I, 5 et S, 8 et B…), ou reprenez la
              photo.
            </Alerte>
          )}
          {ecartsNoms.length > 0 && (
            <Alerte type="info">
              {ecartsNoms
                .map(
                  (c) =>
                    `${c === 'nom' ? 'Nom' : 'Prénoms'} lu${c === 'nom' ? '' : 's'} « ${resultat.champs[c]} », dossier « ${connus?.[c]} »`,
                )
                .join(' ; ')}
              . Regardez le passeport : une lettre parasite (souvent K ou L à la
              place de « &lt; ») est possible ; corrigez la ligne 1 si besoin.
            </Alerte>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-marque-100 bg-carte p-3 text-sm">
            {(
              [
                ['Nom', resultat.champs.nom],
                ['Prénoms', resultat.champs.prenoms],
                ['N° du passeport', resultat.champs.passeportNumero],
                ['Nationalité', resultat.champs.nationalite],
                ['Né(e) le', dateFr(resultat.champs.dateNaissance)],
                [
                  'Sexe',
                  resultat.champs.sexe === 'MASCULIN'
                    ? 'Masculin'
                    : resultat.champs.sexe === 'FEMININ'
                      ? 'Féminin'
                      : '—',
                ],
                ['Expire le', dateFr(resultat.champs.passeportDateExpiration)],
                ['Pays émetteur', resultat.champs.passeportPaysEmetteur],
              ] as const
            ).map(([libelle, valeur]) => (
              <div key={libelle} className="contents">
                <dt className="text-slate-500">{libelle}</dt>
                <dd className="font-medium text-marque-950">{valeur || '—'}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <FormulaireAction
        action={action}
        libelle="Lire et remplir"
        libelleEnCours="Lecture…"
      >
        <Champ
          libelle="Les deux lignes en bas de la page d'identité"
          aide="Remplies par la photo ; avec un lecteur MRZ, cliquez dans la zone puis passez le passeport ; sinon, recopiez les deux lignes (44 caractères chacune)."
        >
          <Zone
            ref={zone}
            name="texte"
            rows={3}
            className="font-mono text-xs uppercase"
            placeholder={
              'P<GINNOM<<PRENOMS<<<<<<<<<<<<<<<<<<<<<<<<<<<\nR01234567GIN9001014M3106159<<<<<<<<<<<<<<04'
            }
            required
          />
        </Champ>
      </FormulaireAction>
    </div>
  );
}
