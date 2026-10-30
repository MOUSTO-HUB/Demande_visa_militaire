import type { Metadata } from 'next';
import { ListeAlertes } from '@/components/liste-alertes';
import { Carte, EnTete } from '@/components/ui';
import { lireApi } from '@/lib/api';
import type { Alerte } from '@/lib/types';

export const metadata: Metadata = { title: 'Alertes · Demandes de visa' };

/**
 * Alertes de toutes les campagnes ouvertes : passeport expirant trop tôt,
 * pièces manquantes, fiches non envoyées à l'approche ou après la date
 * limite, rendez-vous, liens et messages qui ne sont pas parvenus.
 */
export default async function PageAlertes() {
  const alertes = await lireApi<Alerte[]>('/alertes');
  const urgentes = alertes.filter((a) => a.niveau === 'URGENT').length;
  return (
    <>
      <EnTete
        titre="Alertes"
        sousTitre={
          alertes.length
            ? `${alertes.length} alerte(s), dont ${urgentes} urgente(s), sur les campagnes ouvertes.`
            : 'Campagnes ouvertes : rien à signaler.'
        }
      />
      <Carte>
        <ListeAlertes alertes={alertes} avecCampagne />
      </Carte>
    </>
  );
}
