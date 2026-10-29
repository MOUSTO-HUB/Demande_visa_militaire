import { FormulaireAction } from '@/components/formulaire-action';
import { Champ, Liste, Saisie } from '@/components/ui';
import type { EtatFormulaire } from '@/lib/api';
import type { Militaire } from '@/lib/types';

/** Identité administrative du militaire (le reste se remplit dans le dossier). */
export function FormulaireFiche({
  action,
  militaire,
  libelle,
}: {
  action: (
    e: EtatFormulaire | null,
    d: FormData,
  ) => Promise<EtatFormulaire | null>;
  militaire?: Militaire;
  libelle: string;
}) {
  return (
    <FormulaireAction action={action} libelle={libelle}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Champ libelle="Matricule" obligatoire>
          <Saisie
            name="matricule"
            defaultValue={militaire?.matricule}
            maxLength={30}
            required
          />
        </Champ>
        <Champ libelle="Grade">
          <Saisie
            name="grade"
            defaultValue={militaire?.grade ?? ''}
            maxLength={50}
          />
        </Champ>
        <Champ libelle="Unité">
          <Saisie
            name="unite"
            defaultValue={militaire?.unite ?? ''}
            maxLength={100}
          />
        </Champ>
        <Champ libelle="Nom" obligatoire aide="Comme dans le passeport.">
          <Saisie
            name="nom"
            defaultValue={militaire?.nom}
            maxLength={100}
            required
            style={{ textTransform: 'uppercase' }}
          />
        </Champ>
        <Champ libelle="Prénoms" obligatoire>
          <Saisie
            name="prenoms"
            defaultValue={militaire?.prenoms}
            maxLength={150}
            required
            style={{ textTransform: 'uppercase' }}
          />
        </Champ>
        <Champ libelle="Sexe">
          <Liste name="sexe" defaultValue={militaire?.sexe ?? ''}>
            <option value="">—</option>
            <option value="MASCULIN">Masculin</option>
            <option value="FEMININ">Féminin</option>
          </Liste>
        </Champ>
        <Champ libelle="Date de naissance">
          <Saisie
            type="date"
            name="dateNaissance"
            defaultValue={militaire?.dateNaissance?.slice(0, 10) ?? ''}
          />
        </Champ>
        <Champ libelle="Téléphone">
          <Saisie
            type="tel"
            name="telephone"
            defaultValue={militaire?.telephone ?? ''}
            placeholder="+224621123456"
          />
        </Champ>
        <Champ libelle="Email">
          <Saisie
            type="email"
            name="email"
            defaultValue={militaire?.email ?? ''}
          />
        </Champ>
      </div>
    </FormulaireAction>
  );
}
