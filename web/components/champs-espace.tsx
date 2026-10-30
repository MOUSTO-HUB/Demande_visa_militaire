'use client';

import { useRef, useState, type FocusEvent } from 'react';
import type { DefinitionChamp, PaysAccueil } from '@/lib/types';
import { ChampDossier } from './champ-dossier';

type Etat = 'enregistrement' | 'ok' | { erreur: string };

/**
 * Questions d'une étape de l'espace du militaire, enregistrées au fil de la
 * saisie (en quittant chaque champ) : rien n'est perdu si la connexion coupe.
 */
export function ChampsEspace({
  champs,
  pays,
  erreurs,
  lectureSeule,
  enregistrer,
}: {
  champs: (DefinitionChamp & { valeur: string | null })[];
  pays: PaysAccueil;
  erreurs: Record<string, string>;
  lectureSeule: boolean;
  enregistrer: (
    id: string,
    valeur: string,
  ) => Promise<{ erreur?: string; valeur?: string | null }>;
}) {
  const [etats, setEtats] = useState<Record<string, Etat>>({});
  const derniers = useRef(
    Object.fromEntries(champs.map((c) => [c.id, c.valeur ?? ''])),
  );

  async function sauver(
    e: FocusEvent<HTMLDivElement> | React.ChangeEvent<HTMLDivElement>,
  ) {
    const cible = e.target as unknown as
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const id = cible.name;
    if (!id || !(id in derniers.current) || lectureSeule) return;
    const valeur = cible.value;
    if (valeur === derniers.current[id]) return;
    derniers.current[id] = valeur;
    setEtats((s) => ({ ...s, [id]: 'enregistrement' }));
    const r = await enregistrer(id, valeur);
    if (r.valeur !== undefined && r.valeur !== null && r.valeur !== valeur) {
      // Valeur mise en forme par la plateforme (majuscules, indicatif…).
      cible.value = r.valeur;
      derniers.current[id] = r.valeur;
    }
    setEtats((s) => ({ ...s, [id]: r.erreur ? { erreur: r.erreur } : 'ok' }));
  }

  return (
    <div
      className="grid gap-4 sm:grid-cols-2"
      onBlur={sauver}
      onChange={(e) => {
        // Listes (dont oui / non) : enregistrées dès le choix.
        if ((e.target as HTMLElement).tagName === 'SELECT') void sauver(e);
      }}
    >
      {champs.map((c) => {
        const etat = etats[c.id];
        const erreur =
          etat && typeof etat === 'object'
            ? etat.erreur
            : etat
              ? undefined
              : erreurs[c.id];
        return (
          <div key={c.id} className="flex flex-col gap-1">
            <ChampDossier
              champ={c}
              valeur={c.valeur ?? undefined}
              pays={pays}
              erreur={erreur}
              lectureSeule={lectureSeule}
            />
            {etat === 'enregistrement' && (
              <p className="text-xs text-slate-500">Enregistrement…</p>
            )}
            {etat === 'ok' && (
              <p className="text-xs text-emerald-700">Enregistré ✓</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
