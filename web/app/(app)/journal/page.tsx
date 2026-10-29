import type { Metadata } from 'next';
import {
  cellule,
  EnTete,
  Pagination,
  parametre,
  Tableau,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import { dateHeureFr, type EntreeJournal, type Page } from '@/lib/types';

export const metadata: Metadata = { title: 'Journal · Demandes de visa' };

const ACTIONS: Record<string, string> = {
  CONNEXION: 'Connexion',
  CREATION: 'Création',
  MODIFICATION: 'Modification',
  CONSULTATION: 'Consultation',
  EXPORT: 'Export',
  IMPORT: 'Import',
  STATUT: 'Changement de statut',
  SUPPRESSION: 'Suppression',
};

/** Qui a vu, modifié, exporté ou soumis quoi (cahier des charges, 7.5). */
export default async function PageJournal(props: PageProps<'/journal'>) {
  const sp = await props.searchParams;
  const filtres = {
    entite: parametre(sp.entite),
    entiteId: parametre(sp.entiteId),
    page: parametre(sp.page),
  };
  const requete = new URLSearchParams({ parPage: '100' });
  for (const [cle, valeur] of Object.entries(filtres))
    if (valeur) requete.set(cle, valeur);
  const page = await lireApi<Page<EntreeJournal>>(`/journal?${requete}`);
  return (
    <>
      <EnTete
        titre="Journal d'audit"
        sousTitre="Toutes les consultations et modifications, avec l'adresse IP du poste."
      />
      <Tableau
        entetes={['Date', 'Agent', 'Action', 'Objet', 'IP', 'Détails']}
        vide={page.elements.length ? undefined : 'Aucune entrée.'}
      >
        {page.elements.map((e) => (
          <tr key={e.id}>
            <td className={`${cellule} text-xs`}>{dateHeureFr(e.creeLe)}</td>
            <td className={cellule}>
              {e.utilisateur
                ? `${e.utilisateur.prenoms} ${e.utilisateur.nom}`
                : '—'}
            </td>
            <td className={cellule}>{ACTIONS[e.action] ?? e.action}</td>
            <td className={`${cellule} text-xs`}>
              {e.entite}
              {e.entiteId && (
                <span className="block font-mono text-slate-500">
                  {e.entiteId.slice(0, 8)}…
                </span>
              )}
            </td>
            <td className={`${cellule} font-mono text-xs`}>{e.ip ?? '—'}</td>
            <td className="max-w-xs px-4 py-3 font-mono text-xs break-all text-slate-600">
              {e.details ? JSON.stringify(e.details) : ''}
            </td>
          </tr>
        ))}
      </Tableau>
      <Pagination
        page={page.page}
        pages={page.pages}
        total={page.total}
        chemin="/journal"
        parametres={filtres}
      />
    </>
  );
}
