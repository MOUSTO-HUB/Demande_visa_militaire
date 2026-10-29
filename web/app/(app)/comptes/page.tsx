import type { Metadata } from 'next';
import { FormulaireAction } from '@/components/formulaire-action';
import { Badge, Carte, Champ, EnTete, Liste, Saisie } from '@/components/ui';
import { lireApi } from '@/lib/api';
import { profilCourant } from '@/lib/profil';
import {
  dateHeureFr,
  LIBELLES_ROLE,
  type Role,
  type Utilisateur,
} from '@/lib/types';
import {
  changerActif,
  changerRole,
  creerCompte,
  reinitialiser,
} from './actions';

export const metadata: Metadata = { title: 'Comptes · Demandes de visa' };

const ROLES = Object.keys(LIBELLES_ROLE) as Role[];

function ChoixRole({ defaut }: { defaut?: Role }) {
  return (
    <Liste name="role" defaultValue={defaut ?? 'OPERATEUR'}>
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {LIBELLES_ROLE[r]}
        </option>
      ))}
    </Liste>
  );
}

export default async function PageComptes() {
  const [comptes, profil] = await Promise.all([
    lireApi<Utilisateur[]>('/utilisateurs'),
    profilCourant(),
  ]);
  return (
    <>
      <EnTete
        titre="Comptes"
        sousTitre="Comptes nominatifs des agents DGRECM et DGSIC. Un compte n'est jamais partagé."
      />
      <Carte titre="Nouveau compte">
        <FormulaireAction
          action={creerCompte}
          libelle="Créer le compte"
          reinitialiserSiSucces
        >
          <div className="grid gap-4 sm:grid-cols-4">
            <Champ libelle="Prénoms" obligatoire>
              <Saisie name="prenoms" maxLength={100} required />
            </Champ>
            <Champ libelle="Nom" obligatoire>
              <Saisie name="nom" maxLength={100} required />
            </Champ>
            <Champ libelle="Email" obligatoire>
              <Saisie name="email" type="email" required />
            </Champ>
            <Champ libelle="Rôle" obligatoire>
              <ChoixRole />
            </Champ>
          </div>
        </FormulaireAction>
      </Carte>

      <div className="mt-6 flex flex-col gap-3">
        {comptes.map((c) => {
          const bloque =
            c.bloqueJusquA && new Date(c.bloqueJusquA) > new Date();
          const soi = c.id === profil.id;
          return (
            <Carte key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="text-sm">
                  <p className="font-semibold text-marque-950">
                    {c.prenoms} {c.nom} {!c.actif && <Badge>désactivé</Badge>}{' '}
                    {bloque && <Badge couleur="rouge">bloqué</Badge>}{' '}
                    {c.motDePasseProvisoire && (
                      <Badge couleur="orange">mot de passe provisoire</Badge>
                    )}
                  </p>
                  <p className="text-slate-600">
                    {c.email} · {LIBELLES_ROLE[c.role]}
                  </p>
                  <p className="text-xs text-slate-500">
                    Dernière connexion :{' '}
                    {c.derniereConnexion
                      ? dateHeureFr(c.derniereConnexion)
                      : 'jamais'}
                  </p>
                </div>
                {!soi && (
                  <div className="flex flex-wrap items-end gap-2">
                    <FormulaireAction
                      action={changerRole.bind(null, c.id)}
                      libelle="Changer"
                      style="boutonSecondaire"
                      className="flex items-end gap-2"
                    >
                      <ChoixRole defaut={c.role} />
                    </FormulaireAction>
                    <FormulaireAction
                      action={reinitialiser.bind(null, c.id)}
                      libelle="Nouveau mot de passe"
                      style="boutonSecondaire"
                      confirmation="Créer un nouveau mot de passe provisoire ? L'ancien ne fonctionnera plus."
                    />
                    <FormulaireAction
                      action={changerActif.bind(null, c.id, !c.actif)}
                      libelle={c.actif ? 'Désactiver' : 'Réactiver'}
                      style={c.actif ? 'boutonDanger' : 'boutonSecondaire'}
                      confirmation={
                        c.actif
                          ? 'Désactiver ce compte ? Ses sessions seront fermées.'
                          : undefined
                      }
                    />
                  </div>
                )}
              </div>
            </Carte>
          );
        })}
      </div>
    </>
  );
}
