import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import type {
  DepartmentWeeklyReportListQuery,
  DepartmentMonthlyReportListQuery,
} from '@shared/api.interface';

export class DepartmentWeeklyReportQueryDto
  implements DepartmentWeeklyReportListQuery
{
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  weekStart?: string;
}

export class DepartmentMonthlyReportQueryDto
  implements DepartmentMonthlyReportListQuery
{
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  reportMonth?: string;
}
