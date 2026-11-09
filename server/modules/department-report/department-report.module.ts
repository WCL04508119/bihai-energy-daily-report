import { Module } from '@nestjs/common';
import { DepartmentReportController } from './department-report.controller';
import { DepartmentReportService } from './department-report.service';

@Module({
  controllers: [DepartmentReportController],
  providers: [DepartmentReportService],
})
export class DepartmentReportModule {}
