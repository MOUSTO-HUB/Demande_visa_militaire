import type { Metadata } from 'next';
import Link from 'next/link';
import { FormulaireAction } from '@/components/formulaire-action';
import { Alerte, Badge, Carte } from '@/components/ui';
import { lireEspace } from '@/lib/espace';
import { dateFr, dateHeureFr, type FicheEspace } from '@/lib/types';
import { accepterConsentement, envoyerFiche } from './actions';

export const metadata: Metadata = { title: 'Ma demande de visa · DGRECM' };

/** Accueil de l'espace : avancement par étape, pièces, envoi à la DGRECM. */
export default async function AccueilEspace() {
  const fiche = await lireEspace<FicheEspace>('/espace/dossier');
  const piecesManquantes = fiche.pieces.filter(
    (p) => p.exigee && !p.deposee,
  ).length;
  const qui = `${fiche.militaire.grade ? `${fiche.militaire.grade} ` : ''}${fiche.militaire.prenoms} ${fiche.militaire.nom}`;

  // Première connexion : l'information sur les données, avant toute saisie (7.7).
  if (!fiche.consentement.accepte)
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-bold text-marque-950">Bienvenue, {qui}</h1>
        <Carte titre="Avant de commencer : vos données">
          <div className="flex flex-col gap-3 text-sm text-slate-800">
            {fiche.consentement.texte.map((paragraphe) => (
              <p key={paragraphe}>{paragraphe}</p>
            ))}
          </div>
          <div className="mt-4">
            <FormulaireAction
              action={accepterConsentement.bind(
                null,
                fiche.consentement.version,
              )}
              libelle="J’ai lu et j’accepte"
              libelleEnCours="Enregistrement…"
            />
          </div>
        </Carte>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold text-marque-950">{qui}</h1>
        <p className="text-sm text-slate-600">
          {fiche.campagne.libelle} · <Badge>{fiche.libelleStatut}</Badge>
        </p>
      </div>

      {fiche.commentaire && (
        <Alerte>
          La DGRECM vous a renvoyé votre fiche pour correction :{' '}
          <strong>{fiche.commentaire}</strong>
        </Alerte>
      )}
      {fiche.modifiable ? (
        <Alerte type="info">
          Complétez chaque étape
          {fiche.campagne.dateLimiteFiche
            ? ` et envoyez votre fiche avant le ${dateFr(fiche.campagne.dateLimiteFiche)}`
            : ', puis envoyez votre fiche'}
          . Vos réponses sont enregistrées au fur et à mesure : vous pouvez vous
          arrêter et reprendre plus tard avec votre lien.
        </Alerte>
      ) : (
        <Alerte type="succes">
          Votre fiche a été envoyée à la DGRECM.
          {fiche.dateRendezVous
            ? ` Rendez-vous de dépôt : ${dateHeureFr(fiche.dateRendezVous)}. Apportez votre passeport et les originaux de vos pièces.`
            : ' Vous serez prévenu par message de la suite (correction éventuelle, rendez-vous de dépôt).'}
        </Alerte>
      )}

      <Carte titre="Étapes">
        <ol className="flex flex-col divide-y divide-marque-100">
          {fiche.sections.map((s, i) => (
            <li key={s.code}>
              <Link
                href={`/espace/etape/${s.code}`}
                className="flex items-center gap-3 py-3 hover:bg-marque-50/50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marque-100 text-sm font-semibold text-marque-800">
                  {s.obligatoiresManquants === 0 ? '✓' : i + 1}
                </span>
                <span className="flex-1 font-medium text-marque-950">
                  {s.libelle}
                </span>
                <span className="text-xs text-slate-500">
                  {s.obligatoiresManquants
                    ? `${s.obligatoiresManquants} obligatoire(s) à remplir`
                    : `${s.remplis}/${s.champs.length}`}
                </span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/espace/pieces"
              className="flex items-center gap-3 py-3 hover:bg-marque-50/50"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marque-100 text-sm font-semibold text-marque-800">
                {piecesManquantes === 0 ? '✓' : '📎'}
              </span>
              <span className="flex-1 font-medium text-marque-950">
                Pièces (photo, passeport…)
              </span>
              <span className="text-xs text-slate-500">
                {piecesManquantes
                  ? `${piecesManquantes} à déposer`
                  : 'complètes'}
              </span>
            </Link>
          </li>
        </ol>
      </Carte>

      {fiche.modifiable && (
        <Carte titre="Envoyer ma fiche à la DGRECM">
          <p className="mb-3 text-sm text-slate-700">
            {fiche.reponsesObligatoiresManquantes
              ? `Il reste ${fiche.reponsesObligatoiresManquantes} réponse(s) obligatoire(s) à remplir.`
              : 'Toutes les réponses obligatoires sont remplies.'}{' '}
            Après l’envoi, la fiche n’est plus modifiable : vérifiez-la d’abord.
            Vos réponses doivent être exactes : elles seront recopiées telles
            quelles dans la demande officielle.
          </p>
          <FormulaireAction
            action={envoyerFiche}
            libelle="Envoyer ma fiche"
            libelleEnCours="Envoi…"
            confirmation="Envoyer votre fiche à la DGRECM ? Vous ne pourrez plus la modifier."
          />
        </Carte>
      )}
    </div>
  );
}
