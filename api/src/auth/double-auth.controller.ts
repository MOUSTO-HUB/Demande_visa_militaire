import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { UtilisateurConnecte } from './auth.types.js';
import { AvantDoubleAuth } from './decorators/avant-double-auth.decorator.js';
import { UtilisateurCourant } from './decorators/utilisateur-courant.decorator.js';
import { DoubleAuthService } from './double-auth.service.js';
import {
  ActivationDoubleAuthDto,
  ConfirmationMotDePasseDto,
} from './dto/auth.dto.js';

/** Réglages de la double authentification du compte connecté (tous les rôles). */
@ApiTags('Authentification')
@ApiBearerAuth()
@AvantDoubleAuth()
@Controller('auth/double-auth')
export class DoubleAuthController {
  constructor(private readonly service: DoubleAuthService) {}

  @Get()
  etat(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.etat(u);
  }

  /** Clé et QR code à scanner avec l'application ; le mot de passe est redemandé. */
  @Post('preparation')
  @HttpCode(200)
  preparer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: ConfirmationMotDePasseDto,
  ) {
    return this.service.preparer(u, dto.motDePasse);
  }

  /** Confirme l'application par un premier code ; renvoie les codes de secours (affichés une fois). */
  @Post('activation')
  @HttpCode(200)
  activer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: ActivationDoubleAuthDto,
  ) {
    return this.service.activer(u, dto.jeton, dto.code);
  }

  @Post('codes-secours')
  @HttpCode(200)
  codesSecours(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: ConfirmationMotDePasseDto,
  ) {
    return this.service.nouveauxCodesSecours(u, dto.motDePasse);
  }

  /** Seulement pour les rôles où elle n'est pas obligatoire. */
  @Post('desactivation')
  @HttpCode(200)
  desactiver(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: ConfirmationMotDePasseDto,
  ) {
    return this.service.desactiver(u, dto.motDePasse);
  }
}
