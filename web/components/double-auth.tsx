'use client';

import { startTransition, useActionState, type ReactNode } from 'react';
import type { EtatActivation } from '@/app/(app)/compte/actions';
import { Alerte, Champ, Saisie, styles } from './ui';

type Action = (
  e: EtatActivation | null,
  d: FormData,
) => Promise<EtatActivation | null>;

export const ChampMotDePasse = () => (
  <Champ libelle="Votre mot de passe (confirmation)">
    <Saisie
      type="password"
      name="motDePasse"
      autoComplete="current-password"
      required
    />
  </Champ>
);

/** Codes de secours affichés une seule fois, à noter ou imprimer. */
function CodesSecours({ codes, succes }: { codes: string[]; succes?: string }) {
  return (
    <div className="flex flex-col gap-4">
      {succes && <Alerte type="succes">{succes}</Alerte>}
      <p className="text-sm text-slate-700">
        Vos <strong>codes de secours</strong>, affichés une seule fois.
        Notez-les ou imprimez-les et gardez-les à l’abri : chacun remplace une
        fois le code de l’application si vous perdez votre téléphone.
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-lg border border-marque-100 p-3 font-mono text-sm">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={styles.boutonSecondaire}
          onClick={() => window.print()}
        >
          Imprimer
        </button>
        {/* Rechargement complet : la session renouvelée ouvre tout le site. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- rechargement voulu */}
        <a href="/" className={styles.bouton}>
          J’ai noté mes codes
        </a>
      </div>
    </div>
  );
}

function Formulaire({
  envoyer,
  enCours,
  libelle,
  style = 'bouton',
  children,
}: {
  envoyer: (d: FormData) => void;
  enCours: boolean;
  libelle: string;
  style?: keyof typeof styles;
  children: ReactNode;
}) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        startTransition(() => envoyer(donnees));
      }}
    >
      {children}
      <div>
        <button type="submit" disabled={enCours} className={styles[style]}>
          {enCours ? 'Patientez…' : libelle}
        </button>
      </div>
    </form>
  );
}

/**
 * Ajout de l'application : mot de passe, QR code, premier code, codes de secours.
 * Reste monté une fois la double authentification activée (`active`) : la page
 * est rechargée par le serveur après l'activation, et les codes de secours,
 * affichés une seule fois, ne doivent pas disparaître avant d'être notés.
 */
export function ActivationDoubleAuth({
  action,
  active,
  introduction,
  children,
}: {
  action: Action;
  active: boolean;
  /** Texte au-dessus du formulaire, avant l'activation. */
  introduction: ReactNode;
  /** Contenu affiché quand la double authentification est déjà active. */
  children: ReactNode;
}) {
  const [etat, envoyer, enCours] = useActionState(action, null);
  if (etat?.codes)
    return <CodesSecours codes={etat.codes} succes={etat.succes} />;
  if (active) return children;
  const preparation = etat?.preparation;
  return (
    <div className="flex flex-col gap-3">
      {introduction}
      <Formulaire
        envoyer={envoyer}
        enCours={enCours}
        libelle={preparation ? 'Activer' : 'Commencer'}
      >
        {preparation ? (
          <>
            <ol className="list-inside list-decimal space-y-1 text-sm text-slate-700">
              <li>
                Installez sur votre téléphone une application d’authentification
                gratuite (Google Authenticator, Microsoft Authenticator ou
                FreeOTP).
              </li>
              <li>
                Dans l’application, ajoutez un compte en scannant ce code :
              </li>
            </ol>
            {/* eslint-disable-next-line @next/next/no-img-element -- QR code en data URL */}
            <img
              src={preparation.qrCode}
              alt="QR code à scanner avec l’application"
              width={220}
              height={220}
              className="rounded-lg border border-slate-200 bg-white p-2"
            />
            <p className="text-xs text-slate-500">
              Impossible de scanner ? Saisissez cette clé dans l’application :{' '}
              <span className="font-mono break-all text-slate-800">
                {preparation.secret}
              </span>
            </p>
            <Champ libelle="3. Code à 6 chiffres affiché par l’application">
              <Saisie
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="123456"
                required
                autoFocus
              />
            </Champ>
          </>
        ) : (
          <ChampMotDePasse />
        )}
        {etat?.erreur && <Alerte>{etat.erreur}</Alerte>}
      </Formulaire>
    </div>
  );
}

/** Nouveaux codes de secours (les anciens ne marchent plus). */
export function RegenerationCodes({ action }: { action: Action }) {
  const [etat, envoyer, enCours] = useActionState(action, null);
  if (etat?.codes)
    return <CodesSecours codes={etat.codes} succes={etat.succes} />;
  return (
    <Formulaire
      envoyer={envoyer}
      enCours={enCours}
      libelle="Générer de nouveaux codes"
      style="boutonSecondaire"
    >
      <ChampMotDePasse />
      {etat?.erreur && <Alerte>{etat.erreur}</Alerte>}
    </Formulaire>
  );
}
