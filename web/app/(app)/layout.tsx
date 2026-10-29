import { Bandeau } from '@/components/bandeau';
import { Navigation } from '@/components/navigation';
import { profilCourant } from '@/lib/profil';
import { LIBELLES_ROLE } from '@/lib/types';

export default async function LayoutApplication({
  children,
}: LayoutProps<'/'>) {
  const profil = await profilCourant();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Bandeau
        espace={LIBELLES_ROLE[profil.role]}
        utilisateur={`${profil.prenoms} ${profil.nom}`}
      />
      <Navigation role={profil.role} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
