import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PlatformModule } from '@lark-apaas/fullstack-nestjs-core';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { ViewModule } from './modules/view/view.module';
import { DailyReportModule } from './modules/daily-report/daily-report.module';
import { WeeklyReportModule } from './modules/weekly-report/weekly-report.module';
import { MonthlyReportModule } from './modules/monthly-report/monthly-report.module';
import { StatsModule } from './modules/stats/stats.module';
import { DepartmentReportModule } from './modules/department-report/department-report.module';
import { ScheduledSendModule } from './modules/scheduled-send/scheduled-send.module';
import { ReportDocumentModule } from './modules/report-document/report-document.module';
import { TaskPoolModule } from './modules/task-pool/task-pool.module';
import { FeishuModule } from './modules/feishu/feishu.module';
import { FeishuTaskSyncModule } from './modules/feishu-task-sync/feishu-task-sync.module';

@Module({
  imports: [
    // 平台 Module，提供平台能力
    PlatformModule.forRoot(),
    // ====== @route-section: business-modules START ======
    // Place all business modules here.Do NOT add fallback modules here.
    DailyReportModule,
    WeeklyReportModule,
    MonthlyReportModule,
    StatsModule,
    DepartmentReportModule,
    ScheduledSendModule,
    ReportDocumentModule,
    TaskPoolModule,
    FeishuModule,
    FeishuTaskSyncModule,
    // ====== @route-section: business-modules END ======

    // ⚠️ @route-order: last
    // ViewModule is the fallback route module, must be registered last.
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
