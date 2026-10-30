import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/bandeau';
import { FormulaireAction } from '@/components/formulaire-action';
import { Alerte, Champ, parametre, Saisie, styles } from '@/components/ui';
import { ErreurApi } from '@/lib/api';
import { appelPublic } from '@/lib/espace';
import { connecter, demanderCode } from './actions';

export const metadata: Metadata = { title: 'Ma demande de visa · DGRECM' };

interface Ouverture {
  prenoms: string;
  campagne: string;
  canaux: { canal: 'EMAIL' | 'SMS'; destinataire: string }[];
}

/**
 * Lien personnel du militaire : il choisit où recevoir son code (email ou
 * SMS, coordonnées de sa fiche), puis le saisit. Le lien seul ne suffit pas.
 */
export default async function PageLien(props: PageProps<'/m/[jeton]'>) {
  const { jeton } = await props.params;
  const sp = await props.searchParams;
  const etapeCode = parametre(sp.code) === '1';
  const vers = parametre(sp.vers);

  let ouverture: Ouverture | null = null;
  let probleme: string | null = null;
  try {
    ouverture = await appelPublic<Ouverture>('/espace/acces', { jeton });
  } catch (e) {
    if (!(e instanceof ErreurApi)) throw e;
    probleme = e.message;
  }

  return (
    <main className="fond-bandeau flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="flex items-center gap-3 text-xl font-bold tracking-tight text-white">
          <Logo className="h-10 w-10" />
          Ma demande de visa
        </h1>
        <p className="mt-2 mb-5 text-sm text-white/85">
          DGRECM · espace personnel du militaire boursier
        </p>
        <div className="rounded-2xl bg-carte p-5 shadow-2xl shadow-black/40">
          {!ouverture ? (
            <Alerte>{probleme}</Alerte>
          ) : etapeCode ? (
            <>
              <p className="mb-4 text-sm text-slate-700">
                Un code à 6 chiffres vient d’être envoyé
                {vers ? ` à ${vers}` : ''}. Il est valable 10 minutes.
              </p>
              <FormulaireAction
                action={connecter.bind(null, jeton)}
                libelle="Ouvrir ma fiche"
                libelleEnCours="Vérification…"
              >
                <Champ libelle="Code reçu">
                  <Saisie
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9 ]{6,7}"
                    maxLength={7}
                    placeholder="123456"
                    required
                    autoFocus
                  />
                </Champ>
              </FormulaireAction>
              <Link
                href={`/m/${jeton}`}
                className={`mt-4 block text-center text-sm ${styles.lien}`}
              >
                Pas reçu ? Demander un nouveau code
              </Link>
            </>
          ) : (
            <>
              <p className="mb-1 text-sm text-slate-800">
                Bonjour <strong>{ouverture.prenoms}</strong>,
              </p>
              <p className="mb-4 text-sm text-slate-700">
                Pour votre demande de visa ({ouverture.campagne}), recevez
                d’abord un code de connexion :
              </p>
              {ouverture.canaux.length ? (
                <div className="flex flex-col gap-2">
                  {ouverture.canaux.map((c) => (
                    <FormulaireAction
                      key={c.canal}
                      action={demanderCode.bind(null, jeton)}
                      libelle={
                        c.canal === 'EMAIL'
                          ? `Par email (${c.destinataire})`
                          : `Par SMS (${c.destinataire})`
                      }
                      libelleEnCours="Envoi du code…"
                      style={
                        c.canal === 'EMAIL' ? 'bouton' : 'boutonSecondaire'
                      }
                      className="flex flex-col gap-2"
                    >
                      <input type="hidden" name="canal" value={c.canal} />
                    </FormulaireAction>
                  ))}
                </div>
              ) : (
                <Alerte>
                  Aucun email ni téléphone dans votre fiche : contactez la
                  DGRECM.
                </Alerte>
              )}
              <p className="mt-4 text-xs text-slate-500">
                Ce lien est personnel : ne le transmettez à personne.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
