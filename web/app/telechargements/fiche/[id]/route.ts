import { relayerFichier } from '@/lib/telechargement';

/** Fiche récapitulative PDF d'un dossier (dépôt à l'ambassade). */
export async function GET(
  _request: Request,
  ctx: RouteContext<'/telechargements/fiche/[id]'>,
) {
  const { id } = await ctx.params;
  return relayerFichier(`/dossiers/${encodeURIComponent(id)}/fiche`);
}
