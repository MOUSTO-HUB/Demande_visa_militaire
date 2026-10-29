import { relayerFichier } from '@/lib/telechargement';

/** Tableau Excel des dossiers d'une campagne. */
export async function GET(
  _request: Request,
  ctx: RouteContext<'/telechargements/export/[id]'>,
) {
  const { id } = await ctx.params;
  return relayerFichier(`/campagnes/${encodeURIComponent(id)}/export`);
}
