import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FormulaireAction } from '@/components/formulaire-action';
import { Badge, Carte, styles } from '@/components/ui';
import { lireEspace } from '@/lib/espace';
import { dateFr, type FicheEspace } from '@/lib/types';
import { deposerPiece, supprimerPiece } from '../actions';

export const metadata: Metadata = { title: 'Mes pièces · DGRECM' };

/**
 * Dépôt des pièces depuis le téléphone (photo) ou un scan : elles sont mises
 * au format du site officiel par la plateforme (F3.3).
 */
export default async function PiecesEspace() {
  const fiche = await lireEspace<FicheEspace>('/espace/dossier');
  // L'information sur les données s'accepte d'abord, sur l'accueil.
  if (!fiche.consentement.accepte) redirect('/espace');
  return (
    <div className="flex flex-col gap-4">
      <nav className="text-sm">
        <Link href="/espace" className={styles.lien}>
          ← Toutes les étapes
        </Link>
      </nav>
      <div>
        <h1 className="text-lg font-bold text-marque-950">Mes pièces</h1>
        <p className="text-sm text-slate-600">
          Photo nette, document entier, à plat et bien éclairé. Image (JPEG,
          PNG) ou PDF, 10 Mo au plus. Une nouvelle pièce remplace la précédente
          du même type.
        </p>
      </div>
      {fiche.pieces.map((p) => (
        <Carte key={p.code}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-medium text-marque-950">{p.libelle}</span>
            {p.deposee ? (
              <Badge couleur="vert">déposée</Badge>
            ) : p.exigee ? (
              <Badge couleur="orange">à déposer</Badge>
            ) : (
              <Badge>facultative</Badge>
            )}
          </div>
          {p.deposee && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              {p.deposee.nomFichier} · le {dateFr(p.deposee.creeLe)}
              {fiche.modifiable && (
                <FormulaireAction
                  action={supprimerPiece.bind(null, p.deposee.id)}
                  libelle="Retirer"
                  style="boutonDanger"
                  confirmation="Retirer cette pièce ?"
                  className="ml-auto inline-flex"
                />
              )}
            </div>
          )}
          {fiche.modifiable && (
            <FormulaireAction
              action={deposerPiece}
              libelle={p.deposee ? 'Remplacer' : 'Déposer'}
              libelleEnCours="Envoi…"
              style="boutonSecondaire"
              reinitialiserSiSucces
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <input type="hidden" name="type" value={p.code} />
              <input
                type="file"
                name="fichier"
                accept="image/*,application/pdf"
                required
                className="text-sm"
              />
            </FormulaireAction>
          )}
        </Carte>
      ))}
      <Link href="/espace" className={`${styles.bouton} self-start`}>
        Terminé : revenir aux étapes
      </Link>
    </div>
  );
}
