import { Controller, Get, Post, Body, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CanRole } from '@lark-apaas/fullstack-nestjs-core';
import { StatsService } from './stats.service';
import { DataScopeService } from '../data-scope/data-scope.service';
import type {
  AttendanceExportResult,
  AttendanceStats,
  SubmissionStats,
  DepartmentStats,
} from '@shared/api.interface';

@Controller('api/stats')
export class StatsController {
  constructor(
    private readonly statsService: StatsService,
    private readonly dataScope: DataScopeService,
  ) {}

  private async resolveAllowedDepartments(
    req: Request,
  ): Promise<string[] | undefined> {
    const scope = await this.dataScope.resolve(
      req.userContext.roles,
      req.userContext.userId,
    );
    return scope.kind === 'all' ? undefined : scope.departments;
  }

  @CanRole(['hr_admin', 'system_admin', 'dept_director', 'company_leader'])
  @Post('attendance/export')
  async exportAttendance(
    @Req() req: Request,
    @Body() body: { month?: string },
  ): Promise<AttendanceExportResult> {
    const allowed = await this.resolveAllowedDepartments(req);
    return this.statsService.exportAttendance(body.month ?? '', allowed);
  }

  @CanRole(['hr_admin', 'system_admin', 'dept_director', 'company_leader'])
  @Get('attendance')
  async getAttendance(
    @Req() req: Request,
    @Query('month') month: string,
  ): Promise<AttendanceStats> {
    const allowed = await this.resolveAllowedDepartments(req);
    return this.statsService.getAttendance(month, allowed);
  }

  @CanRole(['hr_admin', 'system_admin', 'dept_director', 'company_leader'])
  @Get('submission')
  async getSubmissionStats(
    @Req() req: Request,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('department') department?: string,
  ): Promise<SubmissionStats[]> {
    const allowed = await this.resolveAllowedDepartments(req);
    return this.statsService.getSubmissionStats(
      startDate,
      endDate,
      department,
      allowed,
    );
  }

  @CanRole(['hr_admin', 'system_admin', 'dept_director', 'company_leader'])
  @Get('department')
  async getDepartmentStats(
    @Req() req: Request,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<DepartmentStats[]> {
    const allowed = await this.resolveAllowedDepartments(req);
    return this.statsService.getDepartmentStats(startDate, endDate, allowed);
  }
}
