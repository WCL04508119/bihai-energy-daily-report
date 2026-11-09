import { Module } from '@nestjs/common';
import { MonthlyReportController } from './monthly-report.controller';
import { MonthlyReportService } from './monthly-report.service';

@Module({
  controllers: [MonthlyReportController],
  providers: [MonthlyReportService],
})
export class MonthlyReportModule {}
