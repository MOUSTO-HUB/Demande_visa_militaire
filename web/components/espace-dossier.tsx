import type { EtatFormulaire } from '@/lib/api';
import {
  dateFr,
  dateHeureFr,
  LIBELLES_STATUT_MESSAGE,
  LIBELLES_TYPE_MESSAGE,
  type EtatAcces,
  type StatutDossier,
} from '@/lib/types';
import { FormulaireAction } from './formulaire-action';
import { Badge, Carte } from './ui';

type Action = (
  e: EtatFormulaire | null,
  d: FormData,
) => Promise<EtatFormulaire | null>;

const COULEURS = {
  ENVOYE: 'vert',
  SIMULE: 'bleu',
  A_ENVOYER: 'gris',
  ECHEC: 'rouge',
} as const;

/**
 * Espace du militaire sur la fiche du dossier : lien d'accès, dernière
 * connexion, relance, convocation et messages envoyés.
 */
export function CarteEspaceMilitaire({
  etat,
  statut,
  rendezVous,
  gestion,
  ouverte,
  creerLien,
  relancer,
  convoquer,
}: {
  etat: EtatAcces;
  statut: StatutDossier;
  rendezVous: boolean;
  gestion: boolean;
  ouverte: boolean;
  creerLien: Action;
  relancer: Action;
  convoquer: Action;
}) {
  const { acces, messages } = etat;
  const expire = acces && new Date(acces.expireLe) < new Date();
  const actif = gestion && ouverte;
  return (
    <Carte titre="Espace du militaire et messages">
      <p className="mb-3 text-sm text-slate-700">
        {!acces
          ? "Le militaire n'a pas encore reçu de lien vers son espace."
          : expire
            ? `Lien expiré le ${dateFr(acces.expireLe)}.`
            : `Lien envoyé le ${dateFr(acces.modifieLe)}, valable jusqu'au ${dateFr(acces.expireLe)}. ${
                acces.derniereConnexion
                  ? `Dernière connexion : ${dateHeureFr(acces.derniereConnexion)}.`
                  : 'Jamais connecté.'
              }`}
      </p>
      {actif && (
        <div className="mb-4 flex flex-wrap gap-2">
          {statut === 'A_COMPLETER' && (
            <FormulaireAction
              action={creerLien}
              libelle={
                acces ? 'Renvoyer un nouveau lien' : "Envoyer le lien d'accès"
              }
              libelleEnCours="Envoi…"
              style={acces ? 'boutonSecondaire' : 'bouton'}
              confirmation={
                acces
                  ? "Créer un nouveau lien ? L'ancien ne fonctionnera plus."
                  : undefined
              }
              className="flex flex-col gap-2"
            />
          )}
          {statut === 'A_COMPLETER' && acces && !expire && (
            <FormulaireAction
              action={relancer}
              libelle="Relancer (fiche à compléter)"
              libelleEnCours="Envoi…"
              style="boutonSecondaire"
              className="flex flex-col gap-2"
            />
          )}
          {rendezVous && (statut === 'RDV_PRIS' || statut === 'SOUMIS') && (
            <FormulaireAction
              action={convoquer}
              libelle="Envoyer la convocation au dépôt"
              libelleEnCours="Envoi…"
              style="boutonSecondaire"
              className="flex flex-col gap-2"
            />
          )}
        </div>
      )}
      {messages.length ? (
        <ul className="flex flex-col gap-2 text-sm">
          {messages.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-2">
              <span className="text-slate-500">
                {dateHeureFr(m.envoyeLe ?? m.creeLe)}
              </span>
              <span className="font-medium">
                {LIBELLES_TYPE_MESSAGE[m.type]}
              </span>
              <span className="text-slate-600">
                {m.canal === 'SMS' ? 'SMS' : 'email'} · {m.destinataire}
              </span>
              <Badge couleur={COULEURS[m.statut]}>
                {LIBELLES_STATUT_MESSAGE[m.statut]}
              </Badge>
              {m.erreur && m.statut !== 'ENVOYE' && (
                <span className="w-full text-xs text-red-700">{m.erreur}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">Aucun message envoyé.</p>
      )}
    </Carte>
  );
}
