import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Carte, EnTete, styles } from '@/components/ui';
import { lireApi } from '@/lib/api';
import { profilCourant, referentiel } from '@/lib/profil';
import {
  DRAPEAUX,
  LIBELLES_PAYS,
  peutGerer,
  type Campagne,
  type StatutDossier,
} from '@/lib/types';
import { FormulaireCampagne } from './formulaire-campagne';
import { creerCampagne } from './actions';

export const metadata: Metadata = { title: 'Campagnes · Demandes de visa' };

const TERMINES: StatutDossier[] = ['VISA_OBTENU', 'REFUSE', 'ABANDONNE'];

export default async function PageCampagnes() {
  const [campagnes, profil, ref] = await Promise.all([
    lireApi<Campagne[]>('/campagnes'),
    profilCourant(),
    referentiel(),
  ]);
  return (
    <>
      <EnTete
        titre="Campagnes"
        sousTitre="Une campagne = une vague de boursiers vers un pays (ex. Chine 2026)."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {campagnes.map((c) => {
          const termines = TERMINES.reduce(
            (n, s) => n + (c.parStatut[s] ?? 0),
            0,
          );
          const aValider = c.parStatut.A_VALIDER ?? 0;
          return (
            <Link
              key={c.id}
              href={`/campagnes/${c.id}`}
              className="block rounded-2xl border border-marque-100 bg-carte p-5 shadow-sm transition hover:-translate-y-px hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-marque-950">
                    <span aria-hidden>{DRAPEAUX[c.pays]}</span> {c.libelle}
                  </p>
                  <p className="text-sm text-slate-600">
                    {LIBELLES_PAYS[c.pays]} · {c.annee} · visa {c.typeVisa}
                  </p>
                </div>
                <Badge couleur={c.statut === 'OUVERTE' ? 'vert' : 'gris'}>
                  {c.statut === 'OUVERTE' ? 'Ouverte' : 'Close'}
                </Badge>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="fond-degrade h-full"
                  style={{
                    width: `${c.dossiers ? Math.round((termines / c.dossiers) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {c.dossiers} dossier{c.dossiers > 1 ? 's' : ''} · {termines}{' '}
                terminé{termines > 1 ? 's' : ''}
                {aValider > 0 && (
                  <span className="text-soleil-900">
                    {' '}
                    · {aValider} à valider
                  </span>
                )}
              </p>
            </Link>
          );
        })}
        {!campagnes.length && (
          <p className="text-sm text-slate-600">
            Aucune campagne pour l’instant.
          </p>
        )}
      </div>
      {peutGerer(profil.role) && (
        <div className="mt-8">
          <Carte titre="Nouvelle campagne">
            <FormulaireCampagne
              action={creerCampagne}
              pieces={ref.pieces}
              libelle="Créer la campagne"
            />
          </Carte>
        </div>
      )}
      <p className="mt-6 text-sm">
        <Link href="/dossiers" className={styles.lien}>
          Voir tous les dossiers →
        </Link>
      </p>
    </>
  );
}
