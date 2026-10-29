'use client';

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { EtatFormulaire } from '@/lib/api';
import { Alerte, styles } from './ui';

/**
 * Formulaire relié à une Server Action : affiche l'erreur ou le succès renvoyé
 * et désactive le bouton pendant l'envoi.
 *
 * L'envoi passe par onSubmit plutôt que par l'attribut `action` : React vide un
 * formulaire `action` après chaque envoi, ce qui ferait perdre la saisie en cas d'erreur.
 */
export function FormulaireAction({
  action,
  libelle,
  libelleEnCours = 'Enregistrement…',
  style = 'bouton',
  confirmation,
  reinitialiserSiSucces = false,
  className,
  children,
}: {
  action: (
    etat: EtatFormulaire | null,
    donnees: FormData,
  ) => Promise<EtatFormulaire | null>;
  libelle: string;
  libelleEnCours?: string;
  style?: keyof typeof styles;
  /** Question posée avant l'envoi (action sensible). */
  confirmation?: string;
  /** Vide les champs après un succès (ex. ajout d'un tuteur). */
  reinitialiserSiSucces?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const [etat, envoyer, enCours] = useActionState(action, null);
  const formulaire = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (reinitialiserSiSucces && etat?.succes) formulaire.current?.reset();
  }, [etat, reinitialiserSiSucces]);

  return (
    <form
      ref={formulaire}
      className={className ?? 'flex flex-col gap-4'}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmation && !window.confirm(confirmation)) return;
        const donnees = new FormData(e.currentTarget);
        startTransition(() => envoyer(donnees));
      }}
    >
      {children}
      {etat?.erreur && <Alerte>{etat.erreur}</Alerte>}
      {etat?.succes && <Alerte type="succes">{etat.succes}</Alerte>}
      <div>
        <button type="submit" disabled={enCours} className={styles[style]}>
          {enCours ? libelleEnCours : libelle}
        </button>
      </div>
    </form>
  );
}
