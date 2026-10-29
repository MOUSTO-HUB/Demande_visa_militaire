import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Carte,
  cellule,
  EnTete,
  Pagination,
  parametre,
  Saisie,
  styles,
  Tableau,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import { profilCourant } from '@/lib/profil';
import { dateFr, peutGerer, type Militaire, type Page } from '@/lib/types';
import { creerMilitaire } from './actions';
import { FormulaireFiche } from './formulaire-fiche';

export const metadata: Metadata = { title: 'Militaires · Demandes de visa' };

export default async function PageMilitaires(props: PageProps<'/militaires'>) {
  const sp = await props.searchParams;
  const q = parametre(sp.q);
  const numero = parametre(sp.page);
  const requete = new URLSearchParams({ parPage: '50' });
  if (q) requete.set('q', q);
  if (numero) requete.set('page', numero);
  const [page, profil] = await Promise.all([
    lireApi<Page<Militaire>>(`/militaires?${requete}`),
    profilCourant(),
  ]);
  const gestion = peutGerer(profil.role);
  return (
    <>
      <EnTete
        titre="Militaires"
        sousTitre="Une fiche par militaire, réutilisée d'une campagne à l'autre."
        actions={
          gestion && (
            <Link href="/militaires/import" className={styles.bouton}>
              Importer une liste Excel
            </Link>
          )
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
      <Tableau
        entetes={[
          'Militaire',
          'Matricule',
          'Grade',
          'Unité',
          'Naissance',
          'Dossiers',
        ]}
        vide={page.elements.length ? undefined : 'Aucun militaire.'}
      >
        {page.elements.map((m) => (
          <tr key={m.id} className="hover:bg-marque-50/50">
            <td className={cellule}>
              <Link href={`/militaires/${m.id}`} className={styles.lien}>
                {m.nom} {m.prenoms}
              </Link>
            </td>
            <td className={`${cellule} font-mono text-xs`}>{m.matricule}</td>
            <td className={cellule}>{m.grade ?? '—'}</td>
            <td className={cellule}>{m.unite ?? '—'}</td>
            <td className={cellule}>
              {m.dateNaissance ? dateFr(m.dateNaissance) : '—'}
            </td>
            <td className={cellule}>{m._count?.dossiers ?? 0}</td>
          </tr>
        ))}
      </Tableau>
      <Pagination
        page={page.page}
        pages={page.pages}
        total={page.total}
        chemin="/militaires"
        parametres={{ q }}
      />
      {gestion && (
        <div className="mt-8">
          <Carte titre="Nouveau militaire">
            <FormulaireFiche action={creerMilitaire} libelle="Créer la fiche" />
          </Carte>
        </div>
      )}
    </>
  );
}
