import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { StatsService } from './stats.service';
import type {
  AttendanceExportResult,
  AttendanceStats,
  SubmissionStats,
  DepartmentStats,
} from '@shared/api.interface';

@Controller('api/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Post('attendance/export')
  async exportAttendance(
    @Body() body: { month?: string },
  ): Promise<AttendanceExportResult> {
    return this.statsService.exportAttendance(body.month ?? '');
  }

  @Get('attendance')
  async getAttendance(
    @Query('month') month: string,
  ): Promise<AttendanceStats> {
    return this.statsService.getAttendance(month);
  }

  @Get('submission')
  async getSubmissionStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('department') department?: string,
  ): Promise<SubmissionStats[]> {
    return this.statsService.getSubmissionStats(startDate, endDate, department);
  }

  @Get('department')
  async getDepartmentStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<DepartmentStats[]> {
    return this.statsService.getDepartmentStats(startDate, endDate);
  }
}
