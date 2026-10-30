import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormulaireAction } from '@/components/formulaire-action';
import { Alerte, Badge, Carte, Champ, EnTete, Saisie } from '@/components/ui';
import { lireApi } from '@/lib/api';
import { profilCourant } from '@/lib/profil';
import {
  DRAPEAUX,
  LIBELLES_PAYS,
  type Exigences,
  type PaysAccueil,
} from '@/lib/types';
import { modifierExigences, retablirExigences } from './actions';

export const metadata: Metadata = { title: 'Paramètres · Demandes de visa' };

const SITES: Record<PaysAccueil, string> = { CHINE: 'COVA', RUSSIE: 'kdmid' };

/**
 * Paramètres des sites officiels (cahier des charges, F8.2) : format des
 * pièces, à changer quand un site change ses exigences (sans mise à jour).
 */
export default async function PageParametres() {
  const profil = await profilCourant();
  if (profil.role !== 'ADMIN') redirect('/acces-refuse');
  const exigences = await lireApi<Record<PaysAccueil, Exigences>>(
    '/parametres/exigences',
  );

  return (
    <>
      <EnTete
        titre="Paramètres des sites officiels"
        sousTitre="Format des pièces exigé par chaque site. Les photos et scans déposés sont préparés automatiquement à ce format."
      />
      <div className="mb-4">
        <Alerte type="info">
          Ne changez ces valeurs que si le site officiel les a changées (message
          de refus d’une pièce, consigne du site). Les pièces déjà déposées qui
          ne conviennent plus sont signalées « non conformes » sur les dossiers
          : il faut alors les déposer de nouveau.
        </Alerte>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {(Object.keys(exigences) as PaysAccueil[]).map((pays) => {
          const e = exigences[pays];
          return (
            <Carte
              key={pays}
              titre={`${DRAPEAUX[pays]} ${LIBELLES_PAYS[pays]} (${SITES[pays]})`}
              actions={
                e.personnalisees ? (
                  <Badge couleur="orange">modifiées</Badge>
                ) : (
                  <Badge>valeurs d’origine</Badge>
                )
              }
            >
              <FormulaireAction
                action={modifierExigences.bind(null, pays)}
                libelle="Enregistrer"
                className="flex flex-col gap-4"
              >
                <fieldset className="grid grid-cols-2 gap-3">
                  <legend className="mb-2 text-sm font-semibold text-marque-900">
                    Photo d’identité
                  </legend>
                  <Champ libelle="Largeur (pixels)">
                    <Saisie
                      name="photoLargeur"
                      type="number"
                      min={100}
                      max={3000}
                      defaultValue={e.photo.largeur}
                      required
                    />
                  </Champ>
                  <Champ libelle="Hauteur (pixels)">
                    <Saisie
                      name="photoHauteur"
                      type="number"
                      min={100}
                      max={3000}
                      defaultValue={e.photo.hauteur}
                      required
                    />
                  </Champ>
                  <Champ libelle="Poids minimal (Ko)">
                    <Saisie
                      name="photoPoidsMinKo"
                      type="number"
                      min={0}
                      max={10240}
                      defaultValue={e.photo.poidsMinKo}
                      required
                    />
                  </Champ>
                  <Champ libelle="Poids maximal (Ko)">
                    <Saisie
                      name="photoPoidsMaxKo"
                      type="number"
                      min={10}
                      max={10240}
                      defaultValue={e.photo.poidsMaxKo}
                      required
                    />
                  </Champ>
                </fieldset>
                <fieldset className="grid grid-cols-2 gap-3">
                  <legend className="mb-2 text-sm font-semibold text-marque-900">
                    Documents scannés (passeport, lettres…)
                  </legend>
                  <Champ libelle="Plus grand côté (pixels)">
                    <Saisie
                      name="scanCoteMax"
                      type="number"
                      min={500}
                      max={6000}
                      defaultValue={e.scan.coteMax}
                      required
                    />
                  </Champ>
                  <Champ libelle="Poids maximal (Ko)">
                    <Saisie
                      name="scanPoidsMaxKo"
                      type="number"
                      min={50}
                      max={10240}
                      defaultValue={e.scan.poidsMaxKo}
                      required
                    />
                  </Champ>
                  <label className="col-span-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="scanPdfAccepte"
                      defaultChecked={e.scan.pdfAccepte}
                    />
                    Le site accepte les PDF
                  </label>
                </fieldset>
              </FormulaireAction>
              {e.personnalisees && (
                <div className="mt-3">
                  <FormulaireAction
                    action={retablirExigences.bind(null, pays)}
                    libelle="Rétablir les valeurs d’origine"
                    style="boutonSecondaire"
                    confirmation="Revenir aux valeurs d’origine pour ce site ?"
                    className="inline-flex"
                  />
                </div>
              )}
            </Carte>
          );
        })}
      </div>
    </>
  );
}
