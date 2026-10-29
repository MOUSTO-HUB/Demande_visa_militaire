import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../../generated/prisma/enums.js';
import { CLE_AVANT_DOUBLE_AUTH } from '../decorators/avant-double-auth.decorator.js';
import { CLE_PUBLIC } from '../decorators/public.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const jwt = new JwtService({
  secret: 'secret-des-tests-0123456789-0123456789',
});

/** Contexte d'une requête vers une route portant les métadonnées données. */
function contexte(
  jeton: string | null,
  metadonnees: Record<string, boolean> = {},
) {
  const route = () => undefined;
  for (const [cle, valeur] of Object.entries(metadonnees))
    Reflect.defineMetadata(cle, valeur, route);
  const requete: Record<string, unknown> = {
    headers: jeton ? { authorization: `Bearer ${jeton}` } : {},
  };
  const ctx = {
    getHandler: () => route,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => requete }),
  } as unknown as ExecutionContext;
  return { ctx, requete };
}

describe('JwtAuthGuard', () => {
  const garde = new JwtAuthGuard(jwt, new Reflector());

  it('laisse passer une route publique sans jeton', async () => {
    expect(
      await garde.canActivate(contexte(null, { [CLE_PUBLIC]: true }).ctx),
    ).toBe(true);
  });

  it('refuse une route sans jeton ou avec un faux jeton', async () => {
    await expect(garde.canActivate(contexte(null).ctx)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(garde.canActivate(contexte('abc').ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("attache l'utilisateur à la requête", async () => {
    const jeton = await jwt.signAsync({ sub: 'u1', role: Role.OPERATEUR });
    const { ctx, requete } = contexte(jeton);
    expect(await garde.canActivate(ctx)).toBe(true);
    expect(requete.utilisateur).toEqual({ id: 'u1', role: Role.OPERATEUR });
  });

  it('limite un compte dont la double authentification reste à activer', async () => {
    const jeton = await jwt.signAsync({
      sub: 'u1',
      role: Role.GESTIONNAIRE,
      aActiver: true,
    });
    await expect(garde.canActivate(contexte(jeton).ctx)).rejects.toThrow(
      ForbiddenException,
    );
    expect(
      await garde.canActivate(
        contexte(jeton, { [CLE_AVANT_DOUBLE_AUTH]: true }).ctx,
      ),
    ).toBe(true);
  });
});
