import Link from 'next/link';
import {
  couleurStatut,
  dateHeureFr,
  DRAPEAUX,
  LIBELLES_STATUT,
  ORDRE_STATUTS,
  type DossierListe,
  type Page,
} from '@/lib/types';
import {
  Badge,
  cellule,
  Liste,
  Pagination,
  Saisie,
  styles,
  Tableau,
} from './ui';

/** Filtres (recherche, statut, mes dossiers) ; formulaire GET, sans JavaScript. */
export function FiltresDossiers({
  chemin,
  filtres,
  avecCampagne,
}: {
  chemin: string;
  filtres: Record<string, string | undefined>;
  avecCampagne?: boolean;
}) {
  return (
    <form
      action={chemin}
      className="mb-4 flex flex-wrap items-end gap-3 text-sm"
    >
      {avecCampagne && filtres.campagneId && (
        <input type="hidden" name="campagneId" value={filtres.campagneId} />
      )}
      <label className="flex flex-col gap-1">
        <span className="font-medium text-slate-800">Rechercher</span>
        <Saisie
          name="q"
          defaultValue={filtres.q}
          placeholder="Matricule, nom…"
          className="w-56"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-slate-800">Statut</span>
        <Liste name="statut" defaultValue={filtres.statut ?? ''}>
          <option value="">Tous</option>
          {ORDRE_STATUTS.map((s) => (
            <option key={s} value={s}>
              {LIBELLES_STATUT[s]}
            </option>
          ))}
        </Liste>
      </label>
      <label className="flex items-center gap-2 pb-2">
        <input
          type="checkbox"
          name="operateur"
          value="moi"
          defaultChecked={filtres.operateur === 'moi'}
        />
        Mes dossiers
      </label>
      <button type="submit" className={styles.boutonSecondaire}>
        Filtrer
      </button>
    </form>
  );
}

export function TableauDossiers({
  page,
  chemin,
  filtres,
  avecCampagne = true,
}: {
  page: Page<DossierListe>;
  chemin: string;
  filtres: Record<string, string | undefined>;
  avecCampagne?: boolean;
}) {
  return (
    <>
      <Tableau
        entetes={[
          'Militaire',
          'Matricule',
          ...(avecCampagne ? ['Campagne'] : []),
          'Statut',
          'N° de demande',
          'Pièces',
          'Opérateur',
          'Modifié',
        ]}
        vide={page.elements.length ? undefined : 'Aucun dossier.'}
      >
        {page.elements.map((d) => (
          <tr key={d.id} className="hover:bg-marque-50/50">
            <td className={cellule}>
              <Link href={`/dossiers/${d.id}`} className={styles.lien}>
                {d.militaire.nom} {d.militaire.prenoms}
              </Link>
              {d.militaire.grade && (
                <span className="block text-xs text-slate-500">
                  {d.militaire.grade}
                </span>
              )}
            </td>
            <td className={`${cellule} font-mono text-xs`}>
              {d.militaire.matricule}
            </td>
            {avecCampagne && (
              <td className={cellule}>
                <span aria-hidden>{DRAPEAUX[d.campagne.pays]}</span>{' '}
                {d.campagne.libelle}
              </td>
            )}
            <td className={cellule}>
              <Badge couleur={couleurStatut(d.statut)}>
                {LIBELLES_STATUT[d.statut]}
              </Badge>
            </td>
            <td className={`${cellule} font-mono text-xs`}>
              {d.numeroDemande ?? '—'}
            </td>
            <td className={cellule}>{d._count.pieces}</td>
            <td className={cellule}>
              {d.operateur ? `${d.operateur.prenoms} ${d.operateur.nom}` : '—'}
            </td>
            <td className={`${cellule} text-xs text-slate-500`}>
              {dateHeureFr(d.modifieLe)}
            </td>
          </tr>
        ))}
      </Tableau>
      <Pagination
        page={page.page}
        pages={page.pages}
        total={page.total}
        chemin={chemin}
        parametres={filtres}
      />
    </>
  );
}

/** Paramètres de recherche des dossiers → chaîne de requête de l'API. */
export function requeteDossiers(filtres: Record<string, string | undefined>) {
  const sp = new URLSearchParams({ parPage: '50' });
  for (const cle of ['campagneId', 'statut', 'operateur', 'q', 'page'])
    if (filtres[cle]) sp.set(cle, filtres[cle]!);
  return sp.toString();
}
