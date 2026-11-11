import { Module } from '@nestjs/common';

import { ManagerDashboardController } from './manager-dashboard.controller';
import { ManagerDashboardService } from './manager-dashboard.service';

@Module({
  controllers: [ManagerDashboardController],
  providers: [ManagerDashboardService],
  exports: [ManagerDashboardService],
})
export class ManagerDashboardModule {}
