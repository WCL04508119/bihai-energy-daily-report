import { IsString, IsIn, IsOptional, Matches, IsObject } from 'class-validator';
import { DEPARTMENTS } from '@shared/api.interface';
import type {
  CreateDepartmentMonthlyReportRequest,
  MonthlyTemplateData,
} from '@shared/api.interface';

export class CreateDepartmentMonthlyReportDto
  implements CreateDepartmentMonthlyReportRequest
{
  @IsString()
  @IsIn(DEPARTMENTS)
  department!:
    | '仪电室'
    | '产品创新室'
    | '工艺模块室'
    | '热工室'
    | '工业炉室'
    | '项目部'
    | '财务部'
    | '人力资源部'
    | '国际市场部'
    | '国内市场部'
    | '行政部'
    | '公司领导'
    | '部门领导';

  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  reportMonth!: string;

  @IsString()
  summaryContent!: string;

  @IsOptional()
  @IsString()
  issuesSummary?: string;

  @IsOptional()
  @IsObject()
  templateData?: MonthlyTemplateData;
}
