import { Module } from '@nestjs/common';

import { DailyReportModule } from '../daily-report/daily-report.module';
import { ScheduledSendController } from './scheduled-send.controller';
import { ScheduledSendService } from './scheduled-send.service';
import { ScheduledSendAutomation } from './scheduled-send.automation';

@Module({
  imports: [DailyReportModule],
  controllers: [ScheduledSendController],
  providers: [ScheduledSendService, ScheduledSendAutomation],
})
export class ScheduledSendModule {}
