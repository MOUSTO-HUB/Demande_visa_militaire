import type { Metadata } from 'next';
import { Carte, EnTete, parametre } from '@/components/ui';
import { lireApi } from '@/lib/api';
import type { Campagne } from '@/lib/types';
import { FormulaireImport } from './formulaire-import';

export const metadata: Metadata = {
  title: 'Importer des militaires · Demandes de visa',
};

const COLONNES = [
  ['Matricule', 'obligatoire'],
  ['Nom', 'obligatoire'],
  ['Prénoms', 'obligatoire'],
  ['Grade', ''],
  ['Sexe', 'M ou F'],
  ['Date de naissance', 'JJ/MM/AAAA'],
  ['Unité', ''],
  ['Téléphone', 'avec ou sans +224'],
  ['Email', ''],
];

export default async function PageImport(
  props: PageProps<'/militaires/import'>,
) {
  const campagneId = parametre((await props.searchParams).campagneId);
  const campagnes = (await lireApi<Campagne[]>('/campagnes')).filter(
    (c) => c.statut === 'OUVERTE',
  );
  return (
    <>
      <EnTete
        titre="Importer la liste des boursiers"
        sousTitre="Le fichier de la DGRECM crée les fiches d'un coup. Un matricule déjà connu met sa fiche à jour."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Carte titre="Fichier">
            <FormulaireImport
              campagnes={campagnes.map((c) => ({
                id: c.id,
                libelle: c.libelle,
              }))}
              campagneId={campagneId}
            />
          </Carte>
        </div>
        <Carte titre="Colonnes reconnues">
          <ul className="space-y-1 text-sm">
            {COLONNES.map(([nom, precision]) => (
              <li key={nom}>
                <span className="font-medium text-slate-900">{nom}</span>
                {precision && (
                  <span className="text-slate-500"> · {precision}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            L&apos;ordre des colonnes et les accents des en-têtes n&apos;ont pas
            d&apos;importance. Les noms sont mis en majuscules sans accent,
            comme dans le passeport.
          </p>
        </Carte>
      </div>
    </>
  );
}
