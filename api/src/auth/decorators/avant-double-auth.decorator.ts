import { SetMetadata } from '@nestjs/common';

export const CLE_AVANT_DOUBLE_AUTH = 'avantDoubleAuth';

/**
 * Route accessible à un compte qui doit encore activer sa double
 * authentification (profil, mot de passe, activation). Toutes les autres lui sont fermées.
 */
export const AvantDoubleAuth = () => SetMetadata(CLE_AVANT_DOUBLE_AUTH, true);
