import type { Metadata } from 'next';
import { Logo } from '@/components/bandeau';
import { ChoixTheme } from '@/components/choix-theme';
import { FormulaireAction } from '@/components/formulaire-action';
import { Champ, parametre, Saisie } from '@/components/ui';
import { themeCourant } from '@/lib/theme-serveur';
import { seConnecter } from './actions';

export const metadata: Metadata = { title: 'Connexion · Demandes de visa' };

export default async function PageConnexion(props: PageProps<'/connexion'>) {
  const suite = parametre((await props.searchParams).suite);
  return (
    <main className="fond-bandeau relative flex flex-1 items-center justify-center px-4 py-12">
      <div className="absolute top-4 right-4">
        <ChoixTheme initial={await themeCourant()} />
      </div>
      <div className="w-full max-w-sm">
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-white">
          <Logo className="h-12 w-12" />
          Demandes de visa
        </h1>
        <p className="mt-2 mb-6 text-sm text-white/85">
          DGRECM · militaires boursiers en Chine et en Russie. Accès réservé aux
          agents habilités.
        </p>
        <div className="rounded-2xl bg-carte p-6 shadow-2xl shadow-black/40">
          <FormulaireAction
            action={seConnecter}
            libelle="Se connecter"
            libelleEnCours="Connexion…"
          >
            <input type="hidden" name="suite" value={suite ?? ''} />
            <Champ libelle="Email">
              <Saisie
                type="email"
                name="email"
                autoComplete="username"
                required
                autoFocus
              />
            </Champ>
            <Champ libelle="Mot de passe">
              <Saisie
                type="password"
                name="motDePasse"
                autoComplete="current-password"
                required
              />
            </Champ>
          </FormulaireAction>
          <p className="mt-4 text-center text-xs text-slate-500">
            Mot de passe oublié : adressez-vous à la DGSIC.
          </p>
        </div>
      </div>
    </main>
  );
}
