import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  cellule,
  EnTete,
  Pagination,
  parametre,
  Saisie,
  styles,
  Tableau,
} from '@/components/ui';
import { lireApi, lireApiOuNull } from '@/lib/api';
import type { CampagneDetail, Militaire, Page } from '@/lib/types';
import { ajouterMilitaires } from '../../actions';

export const metadata: Metadata = {
  title: 'Ajouter des militaires · Demandes de visa',
};

/** Militaires déjà enregistrés (campagnes précédentes) à ajouter à cette campagne. */
export default async function PageAjout(
  props: PageProps<'/campagnes/[id]/ajout'>,
) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const q = parametre(sp.q);
  const numero = parametre(sp.page);
  const campagne = await lireApiOuNull<CampagneDetail>(`/campagnes/${id}`);
  if (!campagne) notFound();
  const requete = new URLSearchParams({ horsCampagne: id, parPage: '50' });
  if (q) requete.set('q', q);
  if (numero) requete.set('page', numero);
  const page = await lireApi<Page<Militaire>>(`/militaires?${requete}`);

  return (
    <>
      <EnTete
        titre="Ajouter des militaires"
        sousTitre={campagne.libelle}
        actions={
          <Link href={`/campagnes/${id}`} className={styles.boutonSecondaire}>
            Retour à la campagne
          </Link>
        }
      />
      <form className="mb-4 flex gap-2">
        <Saisie
          name="q"
          defaultValue={q}
          placeholder="Matricule, nom…"
          className="max-w-xs"
        />
        <button type="submit" className={styles.boutonSecondaire}>
          Rechercher
        </button>
      </form>
      <FormulaireAction
        action={ajouterMilitaires.bind(null, id)}
        libelle="Créer les dossiers des militaires cochés"
      >
        <Tableau
          entetes={['', 'Militaire', 'Matricule', 'Grade', 'Unité']}
          vide={
            page.elements.length
              ? undefined
              : 'Aucun militaire hors de cette campagne.'
          }
        >
          {page.elements.map((m) => (
            <tr key={m.id}>
              <td className={cellule}>
                <input
                  type="checkbox"
                  name="militaireIds"
                  value={m.id}
                  aria-label={`${m.nom} ${m.prenoms}`}
                />
              </td>
              <td className={cellule}>
                {m.nom} {m.prenoms}
              </td>
              <td className={`${cellule} font-mono text-xs`}>{m.matricule}</td>
              <td className={cellule}>{m.grade ?? '—'}</td>
              <td className={cellule}>{m.unite ?? '—'}</td>
            </tr>
          ))}
        </Tableau>
      </FormulaireAction>
      <Pagination
        page={page.page}
        pages={page.pages}
        total={page.total}
        chemin={`/campagnes/${id}/ajout`}
        parametres={{ q }}
      />
    </>
  );
}
