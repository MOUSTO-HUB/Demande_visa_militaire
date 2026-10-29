import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { PaginationDto } from '../common/pagination.js';
import { Role } from '../generated/prisma/enums.js';
import { AuditService } from './audit.service.js';

class FiltreJournalDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  entite?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  entiteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  utilisateurId?: string;
}

@ApiTags('Journal')
@ApiBearerAuth()
@Controller('journal')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Roles(Role.ADMIN)
  @Get()
  lister(@Query() { entite, entiteId, utilisateurId, ...p }: FiltreJournalDto) {
    return this.audit.lister({ entite, entiteId, utilisateurId }, p);
  }
}
