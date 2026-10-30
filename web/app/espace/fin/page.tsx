import type { Metadata } from 'next';
import { Alerte } from '@/components/ui';

export const metadata: Metadata = { title: 'Ma demande de visa · DGRECM' };

/** Session terminée (sortie ou 2 heures écoulées) : on revient par son lien. */
export default async function FinEspace(props: PageProps<'/espace/fin'>) {
  const sortie = (await props.searchParams).sortie === '1';
  return (
    <Alerte type="info">
      {sortie
        ? 'Vous êtes sorti de votre espace. Vos réponses sont enregistrées.'
        : 'Votre session a expiré (2 heures). Vos réponses sont enregistrées.'}{' '}
      Pour revenir, ouvrez de nouveau le lien personnel reçu de la DGRECM : un
      nouveau code vous sera envoyé.
    </Alerte>
  );
}
