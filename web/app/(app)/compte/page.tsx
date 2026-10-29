import type { Metadata } from 'next';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  Alerte,
  Carte,
  Champ,
  EnTete,
  parametre,
  Saisie,
} from '@/components/ui';
import { profilCourant } from '@/lib/profil';
import { LIBELLES_ROLE } from '@/lib/types';
import { changerMotDePasse } from './actions';

export const metadata: Metadata = { title: 'Mon compte · Demandes de visa' };

export default async function PageCompte(props: PageProps<'/compte'>) {
  const profil = await profilCourant();
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
      <Carte titre="Changer de mot de passe">
        <div className="max-w-sm">
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
        </div>
      </Carte>
    </>
  );
}
