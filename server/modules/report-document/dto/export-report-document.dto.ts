import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  REPORT_DOCUMENT_TYPES,
  type ExportReportDocumentRequest,
} from '@shared/api.interface';

export class ExportReportDocumentDto implements ExportReportDocumentRequest {
  @IsString()
  @IsIn(REPORT_DOCUMENT_TYPES)
  reportType!: 'weekly' | 'monthly' | 'department-weekly' | 'department-monthly';

  @IsString()
  @IsUUID()
  reportId!: string;
}

export class ReportDocumentListQueryDto {
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
  reportType?: string;
}