import {
  IsArray,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { CreateDailyReportDto } from '../../daily-report/dto/create-daily-report.dto';
import type { CreateScheduledSendRequest } from '@shared/api.interface';

export class CreateScheduledSendDto implements CreateScheduledSendRequest {
  @ValidateNested()
  @Type(() => CreateDailyReportDto)
  report!: CreateDailyReportDto;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: '发送日期格式不正确',
  })
  sendDate!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):(00|30)$/, {
    message: '发送时间仅支持整点或半点',
  })
  sendTime!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientIds?: string[];
}
