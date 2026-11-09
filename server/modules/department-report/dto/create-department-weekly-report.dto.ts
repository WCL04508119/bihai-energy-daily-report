import { IsString, IsIn, IsOptional, Matches, IsObject } from 'class-validator';
import { DEPARTMENTS } from '@shared/api.interface';
import type {
  CreateDepartmentWeeklyReportRequest,
  WeeklyTemplateData,
} from '@shared/api.interface';

export class CreateDepartmentWeeklyReportDto
  implements CreateDepartmentWeeklyReportRequest
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
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  weekStart!: string;

  @IsString()
  summaryContent!: string;

  @IsOptional()
  @IsString()
  issuesSummary?: string;

  @IsOptional()
  @IsObject()
  templateData?: WeeklyTemplateData;
}
