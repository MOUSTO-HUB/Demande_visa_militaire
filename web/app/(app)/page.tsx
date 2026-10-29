import { redirect } from 'next/navigation';
import { profilCourant } from '@/lib/profil';

/** Accueil : un mot de passe provisoire doit d'abord être changé. */
export default async function Accueil() {
  const profil = await profilCourant();
  redirect(
    profil.motDePasseProvisoire
      ? '/compte?premiere=1'
      : profil.role === 'OPERATEUR'
        ? '/dossiers?operateur=moi'
        : '/campagnes',
  );
}
