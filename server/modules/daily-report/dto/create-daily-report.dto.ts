import {
  IsString,
  IsIn,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DEPARTMENTS,
  TASK_SOURCES,
} from '@shared/api.interface';
import type {
  CreateDailyReportRequest,
  DailyCompletionRow,
} from '@shared/api.interface';

export class DailyCompletionRowDto implements DailyCompletionRow {
  @IsArray()
  @IsString({ each: true })
  projectNames!: string[];

  @IsArray()
  @IsString({ each: true })
  projectCodes!: string[];

  @IsOptional()
  @IsString()
  completion?: string;
}

export class CreateDailyReportDto implements CreateDailyReportRequest {
  @IsString()
  reportDate!: string;

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
  @IsIn(TASK_SOURCES)
  taskSource!:
    | '部门日常'
    | '项目任务'
    | '临时需求'
    | '会议安排'
    | '跨部门协作'
    | '飞书任务';

  @IsString()
  taskName!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  projectName?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  projectCode?: string[];

  @IsOptional()
  @IsString()
  plmTask?: string;

  @IsOptional()
  @IsString()
  dayCompletion?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyCompletionRowDto)
  completionRows?: DailyCompletionRowDto[];

  @IsString()
  outputFileCount!: string;

  @IsOptional()
  @IsString()
  assistanceNeeded?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipients?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cc?: string[];
}