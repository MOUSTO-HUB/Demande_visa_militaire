import { FormulaireAction } from '@/components/formulaire-action';
import { Champ, Liste, Saisie } from '@/components/ui';
import type { EtatFormulaire } from '@/lib/api';
import type { CampagneDetail, Referentiel } from '@/lib/types';

/** Création ou modification des informations générales d'une campagne. */
export function FormulaireCampagne({
  action,
  pieces,
  campagne,
  libelle,
}: {
  action: (
    e: EtatFormulaire | null,
    d: FormData,
  ) => Promise<EtatFormulaire | null>;
  pieces: Referentiel['pieces'];
  campagne?: CampagneDetail;
  libelle: string;
}) {
  return (
    <FormulaireAction action={action} libelle={libelle}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ libelle="Libellé" obligatoire>
          <Saisie
            name="libelle"
            defaultValue={campagne?.libelle}
            placeholder="Chine 2026 – Université de Nankin"
            maxLength={150}
            required
          />
        </Champ>
        <Champ
          libelle="Pays d'accueil"
          obligatoire
          aide={
            campagne?.dossiers
              ? 'Ne peut plus changer : la campagne a des dossiers.'
              : undefined
          }
        >
          <Liste
            name="pays"
            defaultValue={campagne?.pays ?? 'CHINE'}
            disabled={!!campagne?.dossiers}
          >
            <option value="CHINE">Chine (COVA)</option>
            <option value="RUSSIE">Russie (kdmid)</option>
          </Liste>
        </Champ>
        <Champ libelle="Année" obligatoire>
          <Saisie
            name="annee"
            type="number"
            min={2020}
            max={2100}
            defaultValue={campagne?.annee ?? new Date().getFullYear()}
            required
          />
        </Champ>
        <Champ libelle="Type de visa" obligatoire aide="Ex. X1 pour la Chine.">
          <Saisie
            name="typeVisa"
            defaultValue={campagne?.typeVisa}
            maxLength={50}
            required
          />
        </Champ>
        <Champ libelle="Référence de l'accord ou de la note de bourse">
          <Saisie
            name="referenceAccord"
            defaultValue={campagne?.referenceAccord ?? ''}
            maxLength={200}
          />
        </Champ>
      </div>
      <fieldset className="text-sm">
        <legend className="mb-2 font-medium text-slate-800">
          Pièces demandées{' '}
          <span className="font-normal text-slate-500">
            (aucune cochée : celles exigées par le pays)
          </span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {pieces.map((p) => (
            <label key={p.code} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="piecesExigees"
                value={p.code}
                defaultChecked={campagne?.piecesExigees.includes(p.code)}
              />
              {p.libelle}
            </label>
          ))}
        </div>
      </fieldset>
    </FormulaireAction>
  );
}
