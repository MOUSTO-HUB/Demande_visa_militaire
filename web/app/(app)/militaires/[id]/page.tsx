import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Carte, EnTete, styles } from '@/components/ui';
import { lireApiOuNull } from '@/lib/api';
import { profilCourant } from '@/lib/profil';
import {
  couleurStatut,
  dateFr,
  DRAPEAUX,
  LIBELLES_STATUT,
  peutGerer,
  type MilitaireDetail,
} from '@/lib/types';
import { modifierMilitaire } from '../actions';
import { FormulaireFiche } from '../formulaire-fiche';

export const metadata: Metadata = { title: 'Militaire · Demandes de visa' };

export default async function PageMilitaire(
  props: PageProps<'/militaires/[id]'>,
) {
  const { id } = await props.params;
  const [militaire, profil] = await Promise.all([
    lireApiOuNull<MilitaireDetail>(`/militaires/${id}`),
    profilCourant(),
  ]);
  if (!militaire) notFound();
  return (
    <>
      <EnTete
        titre={`${militaire.nom} ${militaire.prenoms}`}
        sousTitre={[
          `Matricule ${militaire.matricule}`,
          militaire.grade,
          militaire.unite,
          militaire.dateNaissance &&
            `né(e) le ${dateFr(militaire.dateNaissance)}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      />
      <Carte titre="Demandes de visa">
        {militaire.dossiers.length ? (
          <ul className="divide-y divide-slate-100">
            {militaire.dossiers.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <Link href={`/dossiers/${d.id}`} className={styles.lien}>
                  {DRAPEAUX[d.campagne.pays]} {d.campagne.libelle}
                </Link>
                <span className="flex items-center gap-2 text-sm">
                  {d.numeroDemande && (
                    <span className="font-mono text-xs">{d.numeroDemande}</span>
                  )}
                  <Badge couleur={couleurStatut(d.statut)}>
                    {LIBELLES_STATUT[d.statut]}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">
            Aucun dossier : ajoutez ce militaire à une campagne depuis la page
            de la campagne.
          </p>
        )}
      </Carte>
      {peutGerer(profil.role) && (
        <div className="mt-4">
          <Carte titre="Fiche administrative">
            <FormulaireFiche
              action={modifierMilitaire.bind(null, id)}
              militaire={militaire}
              libelle="Enregistrer"
            />
          </Carte>
        </div>
      )}
    </>
  );
}
