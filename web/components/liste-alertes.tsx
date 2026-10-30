import Link from 'next/link';
import type { Alerte } from '@/lib/types';
import { Badge } from './ui';

/** Alertes du suivi (passeport, pièces, fiche en retard, rendez-vous…), les urgentes d'abord. */
export function ListeAlertes({
  alertes,
  avecCampagne = false,
  limite,
}: {
  alertes: Alerte[];
  avecCampagne?: boolean;
  limite?: number;
}) {
  if (!alertes.length)
    return <p className="text-sm text-slate-600">Aucune alerte. ✅</p>;
  const affichees = limite ? alertes.slice(0, limite) : alertes;
  return (
    <>
      <ul className="divide-y divide-marque-100 text-sm">
        {affichees.map((a, i) => (
          <li
            key={`${a.dossierId}-${a.type}-${i}`}
            className="flex flex-wrap items-center gap-2 py-2"
          >
            <Badge couleur={a.niveau === 'URGENT' ? 'rouge' : 'orange'}>
              {a.niveau === 'URGENT' ? 'Urgent' : 'À surveiller'}
            </Badge>
            {a.militaire ? (
              <Link
                href={`/dossiers/${a.dossierId}`}
                className="font-medium text-marque-800 hover:underline"
              >
                {a.militaire.grade ? `${a.militaire.grade} ` : ''}
                {a.militaire.nom} {a.militaire.prenoms}
              </Link>
            ) : (
              // Site officiel modifié : vers ses correspondances.
              <Link
                href={a.lien ?? '/'}
                className="font-medium text-marque-800 hover:underline"
              >
                Correspondances
              </Link>
            )}
            {avecCampagne && a.campagne && (
              <span className="text-xs text-slate-500">
                {a.campagne.libelle}
              </span>
            )}
            <span className="basis-full text-slate-700 sm:basis-auto">
              {a.message}
            </span>
          </li>
        ))}
      </ul>
      {limite && alertes.length > limite && (
        <p className="mt-2 text-xs text-slate-500">
          … et {alertes.length - limite} autre(s) :{' '}
          <Link href="/alertes" className="text-marque-700 hover:underline">
            toutes les alertes
          </Link>
          .
        </p>
      )}
    </>
  );
}
