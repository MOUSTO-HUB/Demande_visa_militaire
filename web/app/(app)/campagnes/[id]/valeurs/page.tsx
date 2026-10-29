import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChampDossier, ValeursInitiales } from '@/components/champ-dossier';
import { FormulaireAction } from '@/components/formulaire-action';
import { Alerte, Carte, EnTete, styles } from '@/components/ui';
import { lireApiOuNull } from '@/lib/api';
import { referentiel } from '@/lib/profil';
import type { CampagneDetail } from '@/lib/types';
import { enregistrerValeursCommunes } from '../../actions';

export const metadata: Metadata = {
  title: 'Valeurs communes · Demandes de visa',
};

/** Réponses identiques pour tous les boursiers de la vague, saisies une seule fois. */
export default async function PageValeursCommunes(
  props: PageProps<'/campagnes/[id]/valeurs'>,
) {
  const { id } = await props.params;
  const [campagne, ref] = await Promise.all([
    lireApiOuNull<CampagneDetail>(`/campagnes/${id}`),
    referentiel(),
  ]);
  if (!campagne) notFound();
  const champs = ref.champs.filter(
    (c) => c.portee === 'DOSSIER' && !c.communInterdit,
  );
  const sections = ref.sections.filter((s) =>
    champs.some((c) => c.section === s.code),
  );
  const close = campagne.statut === 'CLOSE';

  return (
    <>
      <EnTete
        titre="Valeurs communes"
        sousTitre={campagne.libelle}
        actions={
          <Link href={`/campagnes/${id}`} className={styles.boutonSecondaire}>
            Retour à la campagne
          </Link>
        }
      />
      <div className="mb-4">
        <Alerte type="info">
          Ces réponses sont reprises dans tous les dossiers de la campagne. Un
          dossier peut toujours avoir sa propre réponse, qui remplace alors la
          valeur commune. Les déclarations personnelles (antécédents, santé,
          numéros d’admission…) ne sont jamais communes.
        </Alerte>
      </div>
      <FormulaireAction
        action={enregistrerValeursCommunes.bind(null, id)}
        libelle="Enregistrer les valeurs communes"
      >
        <ValeursInitiales valeurs={campagne.valeursCommunes} />
        {sections.map((s) => (
          <Carte key={s.code} titre={s.libelle}>
            <div className="grid gap-4 sm:grid-cols-2">
              {champs
                .filter((c) => c.section === s.code)
                .map((c) => (
                  <ChampDossier
                    key={c.id}
                    champ={c}
                    pays={campagne.pays}
                    valeur={campagne.valeursCommunes[c.id]}
                    lectureSeule={close}
                  />
                ))}
            </div>
          </Carte>
        ))}
      </FormulaireAction>
    </>
  );
}
