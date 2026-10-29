import type { Metadata } from 'next';
import {
  ActivationDoubleAuth,
  ChampMotDePasse,
  RegenerationCodes,
} from '@/components/double-auth';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  Alerte,
  Carte,
  Champ,
  EnTete,
  parametre,
  Saisie,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import { profilCourant } from '@/lib/profil';
import { LIBELLES_ROLE } from '@/lib/types';
import {
  changerMotDePasse,
  desactiverDoubleAuth,
  etapeActivation,
  regenererCodesSecours,
} from './actions';

export const metadata: Metadata = { title: 'Mon compte · Demandes de visa' };

interface EtatDoubleAuth {
  active: boolean;
  obligatoire: boolean;
  codesSecoursRestants: number;
}

export default async function PageCompte(props: PageProps<'/compte'>) {
  const [profil, doubleAuth] = await Promise.all([
    profilCourant(),
    lireApi<EtatDoubleAuth>('/auth/double-auth'),
  ]);
  const premiere = parametre((await props.searchParams).premiere) === '1';
  return (
    <>
      <EnTete
        titre="Mon compte"
        sousTitre={`${profil.prenoms} ${profil.nom} · ${profil.email} · ${LIBELLES_ROLE[profil.role]}`}
      />
      {(premiere || profil.motDePasseProvisoire) && (
        <div className="mb-4">
          <Alerte type="info">
            Vous utilisez un mot de passe provisoire : choisissez votre propre
            mot de passe pour continuer.
          </Alerte>
        </div>
      )}
      {profil.doubleAuthAActiver && !profil.motDePasseProvisoire && (
        <div className="mb-4">
          <Alerte type="info">
            Votre rôle exige la double authentification : activez-la ci-dessous
            pour accéder aux campagnes et aux dossiers.
          </Alerte>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="Changer de mot de passe">
          <FormulaireAction
            action={changerMotDePasse}
            libelle="Changer le mot de passe"
            reinitialiserSiSucces
          >
            <Champ libelle="Mot de passe actuel">
              <Saisie
                type="password"
                name="actuel"
                autoComplete="current-password"
                required
              />
            </Champ>
            <Champ
              libelle="Nouveau mot de passe"
              aide="10 caractères au moins, avec minuscules, majuscules et chiffres."
            >
              <Saisie
                type="password"
                name="nouveau"
                autoComplete="new-password"
                minLength={10}
                required
              />
            </Champ>
            <Champ libelle="Confirmation">
              <Saisie
                type="password"
                name="confirmation"
                autoComplete="new-password"
                required
              />
            </Champ>
          </FormulaireAction>
        </Carte>

        <Carte titre="Double authentification">
          {profil.motDePasseProvisoire && !doubleAuth.active ? (
            <p className="text-sm text-slate-600">
              Changez d’abord votre mot de passe provisoire.
            </p>
          ) : (
            <ActivationDoubleAuth
              action={etapeActivation}
              active={doubleAuth.active}
              introduction={
                <p className="text-sm text-slate-700">
                  {doubleAuth.obligatoire
                    ? 'Obligatoire pour votre rôle. '
                    : 'Recommandée. '}
                  Un code à 6 chiffres, affiché par une application sur votre
                  téléphone, est demandé en plus du mot de passe. Elle
                  fonctionne sans réseau ni SMS.
                </p>
              }
            >
              <div className="flex flex-col gap-4">
                <p className="text-sm text-slate-700">
                  Activée : à chaque connexion, saisissez le code affiché par
                  votre application d’authentification.
                  {doubleAuth.obligatoire &&
                    ' Elle est obligatoire pour votre rôle.'}
                </p>
                <details className="rounded-lg border border-marque-100 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-marque-800">
                    Codes de secours : {doubleAuth.codesSecoursRestants}{' '}
                    restant(s)
                  </summary>
                  <div className="mt-3">
                    <RegenerationCodes action={regenererCodesSecours} />
                  </div>
                </details>
                {!doubleAuth.obligatoire && (
                  <details className="rounded-lg border border-red-100 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-red-700">
                      Désactiver la double authentification
                    </summary>
                    <div className="mt-3">
                      <FormulaireAction
                        action={desactiverDoubleAuth}
                        libelle="Désactiver"
                        style="boutonDanger"
                        confirmation="Désactiver la double authentification ? Le mot de passe suffira pour vous connecter."
                      >
                        <ChampMotDePasse />
                      </FormulaireAction>
                    </div>
                  </details>
                )}
                <p className="text-xs text-slate-500">
                  Téléphone perdu et plus de codes de secours : la DGSIC
                  réinitialise votre compte.
                </p>
              </div>
            </ActivationDoubleAuth>
          )}
        </Carte>
      </div>
    </>
  );
}
