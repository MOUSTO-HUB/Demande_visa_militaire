import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChampDossier, ValeursInitiales } from '@/components/champ-dossier';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  Alerte,
  Badge,
  Carte,
  Champ,
  EnTete,
  Liste,
  Saisie,
  styles,
  Zone,
} from '@/components/ui';
import { lireApi, lireApiOuNull } from '@/lib/api';
import { profilCourant, referentiel } from '@/lib/profil';
import {
  ACTIONS_STATUT,
  couleurStatut,
  dateHeureFr,
  DRAPEAUX,
  estAgent,
  LIBELLES_STATUT,
  peutGerer,
  tailleFr,
  type DossierDetail,
  type StatutDossier,
} from '@/lib/types';
import {
  attribuer,
  changerStatut,
  deposerPiece,
  enregistrerDonnees,
  lirePasseport,
  supprimerPiece,
} from './actions';

export const metadata: Metadata = { title: 'Dossier · Demandes de visa' };

const AVEC_MOTIF: StatutDossier[] = ['A_COMPLETER', 'REFUSE', 'ABANDONNE'];

export default async function PageDossier(props: PageProps<'/dossiers/[id]'>) {
  const { id } = await props.params;
  const [dossier, profil, ref] = await Promise.all([
    lireApiOuNull<DossierDetail>(`/dossiers/${id}`),
    profilCourant(),
    referentiel(),
  ]);
  if (!dossier) notFound();
  const gestion = peutGerer(profil.role);
  const agent = estAgent(profil.role);
  const operateurs = gestion
    ? await lireApi<{ id: string; prenoms: string; nom: string }[]>(
        '/utilisateurs/operateurs',
      )
    : [];

  const pays = dossier.campagne.pays;
  const bloquants = dossier.anomalies.filter((a) => a.niveau === 'BLOQUANT');
  const avertissements = dossier.anomalies.filter(
    (a) => a.niveau === 'AVERTISSEMENT',
  );
  const erreursChamps = new Map(
    dossier.anomalies.filter((a) => a.champ).map((a) => [a.champ!, a.message]),
  );
  const libellePiece = (code: string) =>
    ref.pieces.find((p) => p.code === code)?.libelle ?? code;
  const typesPieces = [...dossier.campagne.pieces, 'AUTRE'];
  const sections = ref.sections.map((s) => (
    <Carte key={s.code} titre={s.libelle}>
      <div className="grid gap-4 sm:grid-cols-2">
        {ref.champs
          .filter((c) => c.section === s.code)
          .map((c) => (
            <ChampDossier
              key={c.id}
              champ={c}
              pays={pays}
              valeur={dossier.valeurs[c.id]}
              origine={dossier.origines[c.id]}
              erreur={erreursChamps.get(c.id)}
              lectureSeule={!dossier.modifiable}
            />
          ))}
      </div>
    </Carte>
  ));

  return (
    <>
      <EnTete
        titre={`${dossier.militaire.nom} ${dossier.militaire.prenoms}`}
        sousTitre={[
          `Matricule ${dossier.militaire.matricule}`,
          dossier.militaire.grade,
          dossier.militaire.unite,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <a
              href={`/telechargements/fiche/${id}`}
              className={styles.boutonSecondaire}
              target="_blank"
              rel="noopener"
            >
              Fiche PDF
            </a>
            <Link
              href={`/campagnes/${dossier.campagne.id}`}
              className={styles.boutonSecondaire}
            >
              {DRAPEAUX[pays]} {dossier.campagne.libelle}
            </Link>
          </>
        }
      />

      {/* Suivi : statut, numéro, rendez-vous, actions */}
      <Carte
        titre="Suivi de la demande"
        actions={
          <Badge couleur={couleurStatut(dossier.statut)}>
            {LIBELLES_STATUT[dossier.statut]}
          </Badge>
        }
      >
        <dl className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">N° de demande (site officiel)</dt>
            <dd className="font-mono">{dossier.numeroDemande ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Rendez-vous à l’ambassade</dt>
            <dd>
              {dossier.dateRendezVous
                ? dateHeureFr(dossier.dateRendezVous)
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Opérateur</dt>
            <dd>
              {dossier.operateur
                ? `${dossier.operateur.prenoms} ${dossier.operateur.nom}`
                : '—'}
            </dd>
          </div>
        </dl>
        {dossier.commentaire && (
          <div className="mb-4">
            <Alerte type="info">Remarque : {dossier.commentaire}</Alerte>
          </div>
        )}
        <div className="flex flex-wrap items-start gap-4">
          {dossier.suivants.map((vers) => (
            <div
              key={vers}
              className="min-w-64 flex-1 rounded-xl border border-slate-200 p-3"
            >
              <FormulaireAction
                action={changerStatut.bind(null, id, vers)}
                libelle={ACTIONS_STATUT[vers]}
                style={AVEC_MOTIF.includes(vers) ? 'boutonDanger' : 'bouton'}
                className="flex flex-col gap-2"
              >
                {vers === 'SOUMIS' && (
                  <Champ
                    libelle="N° de demande attribué par le site"
                    obligatoire
                  >
                    <Saisie
                      name="numeroDemande"
                      defaultValue={dossier.numeroDemande ?? ''}
                      maxLength={60}
                      required
                    />
                  </Champ>
                )}
                {vers === 'RDV_PRIS' && (
                  <Champ libelle="Date et heure du rendez-vous" obligatoire>
                    <Saisie
                      type="datetime-local"
                      name="dateRendezVous"
                      required
                    />
                  </Champ>
                )}
                {AVEC_MOTIF.includes(vers) && (
                  <Champ libelle="Motif" obligatoire>
                    <Zone
                      name="commentaire"
                      rows={2}
                      maxLength={1000}
                      required
                    />
                  </Champ>
                )}
                {vers === 'VALIDE' && bloquants.length > 0 && (
                  <p className="text-xs text-red-700">
                    {bloquants.length} point(s) bloquant(s) à corriger avant.
                  </p>
                )}
              </FormulaireAction>
            </div>
          ))}
          {!dossier.suivants.length && (
            <p className="text-sm text-slate-600">
              Aucune action possible pour vous à cette étape.
            </p>
          )}
        </div>
        {gestion && (
          <div className="mt-4 max-w-md border-t border-slate-100 pt-4">
            <FormulaireAction
              action={attribuer.bind(null, id)}
              libelle="Attribuer"
              style="boutonSecondaire"
              className="flex items-end gap-2"
            >
              <Champ libelle="Agent chargé de la saisie">
                <Liste
                  name="operateurId"
                  defaultValue={dossier.operateur?.id ?? ''}
                >
                  <option value="">— Personne —</option>
                  {operateurs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.prenoms} {o.nom}
                    </option>
                  ))}
                </Liste>
              </Champ>
            </FormulaireAction>
          </div>
        )}
      </Carte>

      {/* Contrôles */}
      <div className="mt-4">
        {bloquants.length ? (
          <Alerte>
            <p className="mb-1 font-semibold">
              {bloquants.length} point(s) à corriger avant la validation :
            </p>
            <ul className="list-inside list-disc">
              {bloquants.slice(0, 12).map((a, i) => (
                <li key={i}>{a.message}</li>
              ))}
              {bloquants.length > 12 && (
                <li>
                  … et {bloquants.length - 12} autre(s), signalés plus bas.
                </li>
              )}
            </ul>
          </Alerte>
        ) : (
          <Alerte type="succes">
            Aucun point bloquant : le dossier peut être validé.
          </Alerte>
        )}
        {avertissements.length > 0 && (
          <div className="mt-2">
            <Alerte type="info">
              {avertissements.map((a) => a.message).join(' ')}
            </Alerte>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Lecture du passeport */}
        <Carte titre="Lire le passeport (MRZ)">
          {dossier.modifiable ? (
            <FormulaireAction
              action={lirePasseport.bind(null, id)}
              libelle="Lire et remplir"
              libelleEnCours="Lecture…"
            >
              <Champ
                libelle="Les deux lignes en bas de la page d'identité"
                aide="Avec un lecteur MRZ, cliquez dans la zone puis passez le passeport. Sinon, recopiez les deux lignes (44 caractères chacune)."
              >
                <Zone
                  name="texte"
                  rows={3}
                  className="font-mono text-xs uppercase"
                  placeholder={
                    'P<GINNOM<<PRENOMS<<<<<<<<<<<<<<<<<<<<<<<<<<<\nR01234567GIN9001014M3106159<<<<<<<<<<<<<<04'
                  }
                  required
                />
              </Champ>
            </FormulaireAction>
          ) : (
            <p className="text-sm text-slate-600">
              Le dossier n’est plus modifiable à cette étape.
            </p>
          )}
        </Carte>

        {/* Pièces */}
        <Carte titre="Pièces justificatives">
          <ul className="flex flex-col gap-3">
            {typesPieces.map((type) => {
              const deposees = dossier.pieces.filter((p) => p.type === type);
              return (
                <li
                  key={type}
                  className="rounded-xl border border-slate-200 p-3"
                >
                  <p className="text-sm font-medium text-slate-900">
                    {libellePiece(type)}
                    {type !== 'AUTRE' && !deposees.some((p) => !p.purgeeLe) && (
                      <span className="ml-2">
                        <Badge couleur="rouge">manquante</Badge>
                      </span>
                    )}
                  </p>
                  {deposees.map((p) => (
                    <div
                      key={p.id}
                      className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600"
                    >
                      {p.purgeeLe ? (
                        <span>
                          {p.nomFichier} · effacé le {dateHeureFr(p.purgeeLe)}
                        </span>
                      ) : (
                        <>
                          {agent ? (
                            <a
                              href={`/telechargements/piece/${p.id}`}
                              className={styles.lien}
                            >
                              {p.nomFichier}
                            </a>
                          ) : (
                            <span>{p.nomFichier}</span>
                          )}
                          <span>
                            {tailleFr(p.taille)}
                            {p.largeur && ` · ${p.largeur}×${p.hauteur} px`}
                          </span>
                          {dossier.modifiable && (
                            <FormulaireAction
                              action={supprimerPiece.bind(null, p.id)}
                              libelle="Supprimer"
                              style="boutonDanger"
                              confirmation="Supprimer cette pièce ?"
                              className="inline-flex"
                            />
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  {dossier.modifiable && (
                    <FormulaireAction
                      action={deposerPiece.bind(null, id, type)}
                      libelle={
                        deposees.length && type !== 'AUTRE'
                          ? 'Remplacer'
                          : 'Déposer'
                      }
                      libelleEnCours="Préparation…"
                      style="boutonSecondaire"
                      reinitialiserSiSucces
                      className="mt-2 flex flex-wrap items-center gap-2"
                    >
                      <input
                        type="file"
                        name="fichier"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="max-w-full text-xs"
                        required
                      />
                    </FormulaireAction>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Les fichiers sont redimensionnés et compressés au format du site
            officiel, puis chiffrés sur le serveur.
          </p>
        </Carte>
      </div>

      {/* Réponses du formulaire officiel */}
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-marque-950">
          Réponses du formulaire officiel
        </h2>
        {!dossier.modifiable && (
          <div className="mb-3">
            <Alerte type="info">
              {dossier.statut === 'A_VALIDER' && !gestion
                ? 'Le dossier attend la validation de la DGRECM.'
                : 'Lecture seule : un dossier validé doit être rouvert (« Renvoyer pour correction ») pour être modifié.'}
            </Alerte>
          </div>
        )}
        {dossier.modifiable ? (
          <FormulaireAction
            action={enregistrerDonnees.bind(null, id)}
            libelle="Enregistrer les réponses"
            className="flex flex-col gap-4"
          >
            <ValeursInitiales valeurs={dossier.valeurs} />
            {sections}
          </FormulaireAction>
        ) : (
          <div className="flex flex-col gap-4">{sections}</div>
        )}
      </div>

      {/* Historique */}
      <div className="mt-6">
        <Carte titre="Historique">
          {dossier.historique.length ? (
            <ol className="flex flex-col gap-2 text-sm">
              {dossier.historique.map((h) => (
                <li key={h.id} className="flex flex-wrap gap-x-2">
                  <span className="text-slate-500">
                    {dateHeureFr(h.creeLe)}
                  </span>
                  <span>
                    {h.depuis ? `${LIBELLES_STATUT[h.depuis]} → ` : ''}
                    <strong>{LIBELLES_STATUT[h.vers]}</strong>
                  </span>
                  {h.utilisateur && (
                    <span className="text-slate-600">
                      par {h.utilisateur.prenoms} {h.utilisateur.nom}
                    </span>
                  )}
                  {h.commentaire && (
                    <span className="w-full text-slate-700">
                      « {h.commentaire} »
                    </span>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-600">
              Aucun changement de statut.
            </p>
          )}
        </Carte>
      </div>
    </>
  );
}
