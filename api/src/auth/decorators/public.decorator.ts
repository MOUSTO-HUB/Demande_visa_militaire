import { SetMetadata } from '@nestjs/common';

export const CLE_PUBLIC = 'public';

/** Rend une route accessible sans jeton (toutes les autres routes l'exigent). */
export const Public = () => SetMetadata(CLE_PUBLIC, true);
