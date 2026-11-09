import { Module } from '@nestjs/common';
import { WeeklyReportController } from './weekly-report.controller';
import { WeeklyReportService } from './weekly-report.service';

@Module({
  controllers: [WeeklyReportController],
  providers: [WeeklyReportService],
})
export class WeeklyReportModule {}
