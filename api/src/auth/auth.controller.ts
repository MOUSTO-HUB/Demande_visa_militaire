import { Body, Controller, Get, HttpCode, Ip, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Limiteur } from '../securite/limiteur.js';
import { AuthService } from './auth.service.js';
import type { Session, UtilisateurConnecte } from './auth.types.js';
import { Public } from './decorators/public.decorator.js';
import { UtilisateurCourant } from './decorators/utilisateur-courant.decorator.js';
import {
  ChangementMotDePasseDto,
  ConnexionDto,
  RafraichissementDto,
} from './dto/auth.dto.js';

/** 20 essais de connexion par quart d'heure et par adresse IP. */
const limiteConnexion = new Limiteur(20, 15 * 60 * 1000);

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Email et mot de passe ; blocage progressif après 5 essais incorrects. */
  @Public()
  @Post('connexion')
  @HttpCode(200)
  connexion(@Body() dto: ConnexionDto, @Ip() ip: string): Promise<Session> {
    limiteConnexion.verifier(ip);
    return this.auth.connexion(dto.email, dto.motDePasse);
  }

  @Public()
  @Post('rafraichir')
  @HttpCode(200)
  rafraichir(@Body() dto: RafraichissementDto): Promise<Session> {
    return this.auth.rafraichir(dto.jetonRafraichissement);
  }

  @Public()
  @Post('deconnexion')
  @HttpCode(204)
  async deconnexion(@Body() dto: RafraichissementDto): Promise<void> {
    await this.auth.deconnexion(dto.jetonRafraichissement);
  }

  /** Tout utilisateur connecté : son profil. */
  @ApiBearerAuth()
  @Get('moi')
  moi(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.auth.profil(u.id);
  }

  /** Tout utilisateur connecté : changer son mot de passe. */
  @ApiBearerAuth()
  @Post('mot-de-passe')
  @HttpCode(204)
  async changerMotDePasse(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: ChangementMotDePasseDto,
  ): Promise<void> {
    await this.auth.changerMotDePasse(u, dto.actuel, dto.nouveau);
  }
}
