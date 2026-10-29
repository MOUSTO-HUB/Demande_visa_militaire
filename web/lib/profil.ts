import 'server-only';
import { cache } from 'react';
import { lireApi } from './api';
import type { Profil, Referentiel } from './types';

/** Profil de l'utilisateur connecté, lu une seule fois par requête. */
export const profilCourant = cache(() => lireApi<Profil>('/auth/moi'));

/** Dictionnaire des champs et des pièces, lu une seule fois par requête. */
export const referentiel = cache(() => lireApi<Referentiel>('/referentiel'));
