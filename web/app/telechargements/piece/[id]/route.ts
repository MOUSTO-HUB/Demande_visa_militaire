import { relayerFichier } from '@/lib/telechargement';

/** Pièce déchiffrée par l'API, prête à téléverser sur le site officiel. */
export async function GET(
  _request: Request,
  ctx: RouteContext<'/telechargements/piece/[id]'>,
) {
  const { id } = await ctx.params;
  return relayerFichier(`/pieces/${encodeURIComponent(id)}/fichier`);
}
