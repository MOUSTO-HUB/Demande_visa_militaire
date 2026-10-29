import Link from 'next/link';
import type { ReactNode } from 'react';
import { seDeconnecter } from '@/app/connexion/actions';
import { ChoixTheme } from '@/components/choix-theme';
import { themeCourant } from '@/lib/theme-serveur';

/** Passeport stylisé de l'icône de l'application. */
export function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span
      className={`fond-degrade inline-flex shrink-0 items-center justify-center rounded-xl shadow-md ring-1 ring-white/30 ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-2/3 w-2/3" fill="none">
        <rect x="5" y="2.5" width="14" height="19" rx="2" fill="#fff" />
        <circle cx="12" cy="10" r="3.2" stroke="#1d4ed8" strokeWidth="1.4" />
        <path
          d="M8.8 10h6.4M12 6.8c1.2 1.4 1.2 4.9 0 6.4M12 6.8c-1.2 1.4-1.2 4.9 0 6.4"
          stroke="#1d4ed8"
          strokeWidth="1"
        />
        <rect x="8.5" y="16.2" width="7" height="1.4" rx=".7" fill="#1d4ed8" />
      </svg>
    </span>
  );
}

/** Bandeau du haut : logo, utilisateur, thème, déconnexion. */
export async function Bandeau({
  espace,
  utilisateur,
}: {
  espace: string;
  utilisateur: ReactNode;
}) {
  return (
    <header className="fond-bandeau text-white shadow-lg shadow-black/20">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Logo />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-lg font-bold tracking-tight">
              Demandes de visa
            </span>
            <span className="truncate text-xs font-medium text-soleil-300">
              DGRECM · {espace}
            </span>
          </span>
        </Link>
        <div className="flex min-w-0 items-center gap-1.5 text-sm sm:gap-2">
          <ChoixTheme initial={await themeCourant()} />
          <Link
            href="/compte"
            title="Mon compte"
            className="hidden truncate rounded-full px-3 py-1.5 text-white/90 hover:bg-white/10 hover:text-white sm:block"
          >
            {utilisateur}
          </Link>
          <form action={seDeconnecter}>
            <button
              type="submit"
              className="rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-white backdrop-blur transition hover:bg-white/20"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
