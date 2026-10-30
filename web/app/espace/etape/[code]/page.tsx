import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChampsEspace } from '@/components/champs-espace';
import { FormulaireAction } from '@/components/formulaire-action';
import { styles } from '@/components/ui';
import { lireEspace } from '@/lib/espace';
import type { FicheEspace } from '@/lib/types';
import { enregistrerEtape, enregistrerReponse } from '../../actions';

export const metadata: Metadata = { title: 'Ma demande de visa · DGRECM' };

/** Une étape courte du formulaire guidé, enregistrée au fil de la saisie. */
export default async function EtapeEspace(
  props: PageProps<'/espace/etape/[code]'>,
) {
  const { code } = await props.params;
  const fiche = await lireEspace<FicheEspace>('/espace/dossier');
  // L'information sur les données s'accepte d'abord, sur l'accueil.
  if (!fiche.consentement.accepte) redirect('/espace');
  const index = fiche.sections.findIndex((s) => s.code === code);
  if (index === -1) notFound();
  const section = fiche.sections[index];
  const suivante = fiche.sections[index + 1];
  const suite = suivante ? `/espace/etape/${suivante.code}` : '/espace/pieces';

  const champs = (
    <ChampsEspace
      champs={section.champs}
      pays={fiche.campagne.pays}
      erreurs={fiche.erreurs}
      lectureSeule={!fiche.modifiable}
      enregistrer={enregistrerReponse}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <nav className="text-sm">
        <Link href="/espace" className={styles.lien}>
          ← Toutes les étapes
        </Link>
      </nav>
      <div>
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          Étape {index + 1} sur {fiche.sections.length}
        </p>
        <h1 className="text-lg font-bold text-marque-950">{section.libelle}</h1>
        <p className="text-sm text-slate-600">
          Les champs marqués * sont obligatoires. Écrivez les noms comme dans
          votre passeport.
        </p>
      </div>
      <div className="rounded-2xl border border-marque-100 bg-carte p-4 shadow-sm">
        {fiche.modifiable ? (
          <FormulaireAction
            action={enregistrerEtape.bind(null, suite)}
            libelle={
              suivante
                ? 'Enregistrer et continuer'
                : 'Enregistrer et passer aux pièces'
            }
            libelleEnCours="Enregistrement…"
          >
            {champs}
          </FormulaireAction>
        ) : (
          champs
        )}
      </div>
    </div>
  );
}
