import type { Metadata } from 'next';
import {
  FiltresDossiers,
  requeteDossiers,
  TableauDossiers,
} from '@/components/tableau-dossiers';
import { EnTete, parametre } from '@/components/ui';
import { lireApi } from '@/lib/api';
import type { DossierListe, Page } from '@/lib/types';

export const metadata: Metadata = { title: 'Dossiers · Demandes de visa' };

export default async function PageDossiers(props: PageProps<'/dossiers'>) {
  const sp = await props.searchParams;
  const filtres = {
    q: parametre(sp.q),
    statut: parametre(sp.statut),
    operateur: parametre(sp.operateur),
    campagneId: parametre(sp.campagneId),
    page: parametre(sp.page),
  };
  const page = await lireApi<Page<DossierListe>>(
    `/dossiers?${requeteDossiers(filtres)}`,
  );
  return (
    <>
      <EnTete
        titre={filtres.operateur === 'moi' ? 'Mes dossiers' : 'Dossiers'}
        sousTitre="Toutes campagnes confondues. Cliquez sur un nom pour ouvrir le dossier."
      />
      <FiltresDossiers chemin="/dossiers" filtres={filtres} avecCampagne />
      <TableauDossiers page={page} chemin="/dossiers" filtres={filtres} />
    </>
  );
}
