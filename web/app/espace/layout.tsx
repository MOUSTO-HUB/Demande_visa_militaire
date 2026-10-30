import { cookies } from 'next/headers';
import { Logo } from '@/components/bandeau';
import { COOKIE_ESPACE } from '@/lib/espace';
import { seDeconnecter } from './actions';

/**
 * Espace du militaire : pages légères pour le téléphone (connexion faible),
 * sans menu des agents.
 */
export default async function GabaritEspace({
  children,
}: LayoutProps<'/espace'>) {
  const connecte = !!(await cookies()).get(COOKIE_ESPACE);
  return (
    <div className="flex flex-1 flex-col">
      <header className="fond-bandeau px-4 py-3 text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Logo className="h-8 w-8" />
          <span className="font-semibold">Ma demande de visa</span>
          {connecte && (
            <form action={seDeconnecter} className="ml-auto">
              <button className="rounded-md border border-white/40 px-3 py-1 text-sm hover:bg-white/10">
                Quitter
              </button>
            </form>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        {children}
      </main>
    </div>
  );
}
