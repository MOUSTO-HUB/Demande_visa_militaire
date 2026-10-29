import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  parPage: number = 25;
}

export interface Page<T> {
  elements: T[];
  total: number;
  page: number;
  parPage: number;
  pages: number;
}

export function page<T>(
  elements: T[],
  total: number,
  { page, parPage }: PaginationDto,
): Page<T> {
  return { elements, total, page, parPage, pages: Math.ceil(total / parPage) };
}

export const sauter = ({ page, parPage }: PaginationDto) => ({
  skip: (page - 1) * parPage,
  take: parPage,
});
