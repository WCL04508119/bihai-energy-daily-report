import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CanRole, NeedLogin } from '@lark-apaas/fullstack-nestjs-core';

import { ManagerDashboardService } from './manager-dashboard.service';
import {
  MANAGER_PERIODS,
  type ManagerAnalysisContext,
  type ManagerDashboardResponse,
  type ManagerPeriod,
} from '@shared/api.interface';

const toPeriod = (period?: string): ManagerPeriod =>
  (MANAGER_PERIODS as readonly string[]).includes(period ?? '')
    ? (period as ManagerPeriod)
    : 'week';

@Controller('api/manager-dashboard')
@NeedLogin()
export class ManagerDashboardController {
  constructor(private readonly dashboard: ManagerDashboardService) {}

  @Get('summary')
  @CanRole(['dept_director', 'company_leader', 'system_admin'])
  async summary(
    @Req() req: Request,
    @Query('period') period?: string,
    @Query('anchor') anchor?: string,
    @Query('department') department?: string,
  ): Promise<ManagerDashboardResponse> {
    return this.dashboard.summary({
      period: toPeriod(period),
      anchor,
      department: department && department !== 'all' ? department : undefined,
      roles: req.userContext.roles,
      userId: req.userContext.userId,
    });
  }

  @Get('analysis-context')
  @CanRole(['dept_director', 'company_leader', 'system_admin'])
  async analysisContext(
    @Req() req: Request,
    @Query('period') period?: string,
    @Query('anchor') anchor?: string,
    @Query('department') department?: string,
  ): Promise<ManagerAnalysisContext> {
    return this.dashboard.analysisContext({
      period: toPeriod(period),
      anchor,
      department: department && department !== 'all' ? department : undefined,
      roles: req.userContext.roles,
      userId: req.userContext.userId,
    });
  }
}
