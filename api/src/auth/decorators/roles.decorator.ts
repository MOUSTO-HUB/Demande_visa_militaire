import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../generated/prisma/enums.js';

export const CLE_ROLES = 'roles';

/** Restreint une route (ou un contrôleur) aux rôles indiqués. */
export const Roles = (...roles: Role[]) => SetMetadata(CLE_ROLES, roles);
