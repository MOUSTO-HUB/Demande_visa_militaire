import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  Alerte,
  Badge,
  Carte,
  Champ,
  EnTete,
  Liste,
  parametre,
  Saisie,
  styles,
  Zone,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import { referentiel } from '@/lib/profil';
import {
  dateHeureFr,
  LIBELLES_MODE,
  type ChampSite,
  type ModeCorrespondance,
  type PaysAccueil,
} from '@/lib/types';
import { enregistrerCorrespondance, supprimerChamp } from './actions';

export const metadata: Metadata = {
  title: 'Correspondances · Demandes de visa',
};

const SITES: Record<string, { pays: PaysAccueil; nom: string }> = {
  chine: { pays: 'CHINE', nom: 'COVA (Chine)' },
};

const MODES = Object.keys(LIBELLES_MODE) as ModeCorrespondance[];

/** Champ obligatoire qui ne sera pas rempli, ou proposition à vérifier. */
const aTraiter = (c: ChampSite) =>
  c.propose || (c.obligatoire && c.mode === 'A_DEFINIR');

/**
 * Champs du formulaire officiel relevés par l'extension, et la réponse du
 * dossier à y recopier. Par défaut, seuls les champs obligatoires sont remplis.
 */
export default async function PageCorrespondances(
  props: PageProps<'/sites/[pays]'>,
) {
  const { pays: code } = await props.params;
  const site = SITES[code];
  if (!site) notFound();
  const filtre = parametre((await props.searchParams).filtre);
  const [champs, ref] = await Promise.all([
    lireApi<ChampSite[]>(`/sites/${site.pays}/champs`),
    referentiel(),
  ]);
  const affiches = filtre === 'a-traiter' ? champs.filter(aTraiter) : champs;
  const pages = [...new Set(affiches.map((c) => c.page))];
  const obligatoires = champs.filter((c) => c.obligatoire);
  const sansCorrespondance = obligatoires.filter((c) => c.mode === 'A_DEFINIR');
  const propositions = champs.filter((c) => c.propose);
  const champsDossier = ref.champs;
  const libelleChamp = (id: string | null) =>
    champsDossier.find((c) => c.id === id)?.libelle ?? id ?? '';

  return (
    <>
      <EnTete
        titre={`Correspondances ${site.nom}`}
        sousTitre="Chaque champ du formulaire officiel, relevé par l'extension, et la réponse du dossier qui y sera recopiée."
        actions={
          <Link
            href={`/sites/${code}${filtre === 'a-traiter' ? '' : '?filtre=a-traiter'}`}
            className={styles.boutonSecondaire}
          >
            {filtre === 'a-traiter'
              ? 'Tous les champs'
              : 'Seulement les champs à traiter'}
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[
          ['Champs relevés', champs.length],
          ['Obligatoires', obligatoires.length],
          ['Obligatoires non reliés', sansCorrespondance.length],
          ['Propositions à vérifier', propositions.length],
        ].map(([libelle, nombre]) => (
          <div
            key={libelle}
            className="rounded-xl border border-marque-100 bg-carte p-3 text-sm shadow-sm"
          >
            <p className="text-2xl font-bold text-marque-950">{nombre}</p>
            <p className="text-slate-600">{libelle}</p>
          </div>
        ))}
      </div>

      {!champs.length ? (
        <Alerte type="info">
          Aucun champ relevé. Sur le site officiel, ouvrez chaque page du
          formulaire et cliquez « Relever les champs de cette page » dans
          l’extension. Pensez aux sections qui n’apparaissent qu’après un choix
          (conjoint, visas antérieurs…).
        </Alerte>
      ) : (
        <div className="mb-4">
          <Alerte type="info">
            Les propositions viennent du libellé du champ : vérifiez-les avant
            la première campagne. « Remplir » est coché d’office pour les champs
            obligatoires ; cochez-le pour un champ facultatif que vous voulez
            aussi remplir.
          </Alerte>
        </div>
      )}

      {pages.map((page) => (
        <div key={page} className="mt-6">
          <h2 className="mb-3 font-mono text-sm font-semibold text-marque-900">
            Page {page}
          </h2>
          <div className="flex flex-col gap-3">
            {affiches
              .filter((c) => c.page === page)
              .map((c) => (
                <Carte key={c.id}>
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-marque-950">
                      {c.libelle || c.cle}
                    </span>
                    {c.obligatoire ? (
                      <Badge couleur="rouge">obligatoire</Badge>
                    ) : (
                      <Badge>facultatif</Badge>
                    )}
                    <Badge couleur="bleu">{c.type}</Badge>
                    {c.propose && (
                      <Badge couleur="orange">proposition à vérifier</Badge>
                    )}
                    <span className="font-mono text-xs text-slate-500">
                      {c.cle}
                    </span>
                    <span className="ml-auto text-xs text-slate-500">
                      relevé le {dateHeureFr(c.dernierReleve)}
                    </span>
                  </div>
                  <FormulaireAction
                    action={enregistrerCorrespondance.bind(null, c.id)}
                    libelle="Enregistrer"
                    style="boutonSecondaire"
                    className="flex flex-col gap-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Champ libelle="Source de la valeur">
                        <Liste name="mode" defaultValue={c.mode}>
                          {MODES.map((m) => (
                            <option key={m} value={m}>
                              {LIBELLES_MODE[m]}
                            </option>
                          ))}
                        </Liste>
                      </Champ>
                      <Champ
                        libelle="Réponse du dossier"
                        aide={
                          c.mode === 'CHAMP'
                            ? libelleChamp(c.champId)
                            : 'Si « Réponse du dossier »'
                        }
                      >
                        <Liste name="champId" defaultValue={c.champId ?? ''}>
                          <option value="">—</option>
                          {ref.sections.map((s) => (
                            <optgroup key={s.code} label={s.libelle}>
                              {champsDossier
                                .filter((x) => x.section === s.code)
                                .map((x) => (
                                  <option key={x.id} value={x.id}>
                                    {x.libelle}
                                  </option>
                                ))}
                            </optgroup>
                          ))}
                        </Liste>
                      </Champ>
                      <Champ
                        libelle="Valeur fixe"
                        aide="Si « Valeur fixe » (identique pour tous les dossiers)"
                      >
                        <Saisie
                          name="valeurFixe"
                          defaultValue={c.valeurFixe ?? ''}
                          maxLength={500}
                        />
                      </Champ>
                    </div>
                    {c.options.length > 0 && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Champ
                          libelle="Conversions"
                          aide="Une par ligne : VALEUR_DU_DOSSIER = valeur du site. Sans conversion, le choix est cherché par son libellé."
                        >
                          <Zone
                            name="conversions"
                            rows={3}
                            className="font-mono text-xs"
                            defaultValue={Object.entries(c.conversions)
                              .map(([k, v]) => `${k} = ${v}`)
                              .join('\n')}
                          />
                        </Champ>
                        <details className="text-xs">
                          <summary className="cursor-pointer font-medium text-marque-800">
                            {c.options.length} choix proposés par le site
                          </summary>
                          <ul className="mt-2 max-h-40 overflow-y-auto font-mono">
                            {c.options.slice(0, 300).map((o) => (
                              <li key={o.valeur}>
                                {o.valeur} = {o.libelle}
                              </li>
                            ))}
                          </ul>
                        </details>
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="remplir"
                        defaultChecked={c.remplir}
                      />
                      Remplir ce champ
                      {c.formatDate && (
                        <span className="text-xs text-slate-500">
                          (date au format {c.formatDate})
                        </span>
                      )}
                    </label>
                  </FormulaireAction>
                  <div className="mt-2 flex justify-end">
                    <FormulaireAction
                      action={supprimerChamp.bind(null, c.id)}
                      libelle="Retirer (champ disparu du site)"
                      style="boutonDanger"
                      confirmation="Retirer ce champ ? Il sera recréé s'il est relevé de nouveau."
                      className="inline-flex"
                    />
                  </div>
                </Carte>
              ))}
          </div>
        </div>
      ))}
    </>
  );
}
