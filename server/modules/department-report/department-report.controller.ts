import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CanRole } from '@lark-apaas/fullstack-nestjs-core';
import { DepartmentReportService } from './department-report.service';
import {
  DepartmentWeeklyReportQueryDto,
  DepartmentMonthlyReportQueryDto,
} from './dto/department-report-query.dto';
import { CreateDepartmentWeeklyReportDto } from './dto/create-department-weekly-report.dto';
import { CreateDepartmentMonthlyReportDto } from './dto/create-department-monthly-report.dto';
import type {
  DepartmentWeeklyReport,
  DepartmentWeeklyReportListResponse,
  DepartmentWeeklyReportDetail,
  DepartmentMonthlyReport,
  DepartmentMonthlyReportListResponse,
  DepartmentMonthlyReportDetail,
} from '@shared/api.interface';

@Controller('api/department-report')
export class DepartmentReportController {
  constructor(
    private readonly departmentReportService: DepartmentReportService,
  ) {}

  @Get('weekly')
  async findWeekly(
    @Query() query: DepartmentWeeklyReportQueryDto,
  ): Promise<DepartmentWeeklyReportListResponse> {
    return this.departmentReportService.findWeekly(query);
  }

  @Get('weekly/:id')
  async findWeeklyOne(
    @Param('id') id: string,
  ): Promise<DepartmentWeeklyReportDetail> {
    return this.departmentReportService.findWeeklyOne(id);
  }

  @CanRole(['dept_director'])
  @Post('weekly')
  async createWeekly(
    @Req() req: Request,
    @Body() dto: CreateDepartmentWeeklyReportDto,
  ): Promise<DepartmentWeeklyReport> {
    const { userId } = req.userContext;
    return this.departmentReportService.createWeekly(dto, userId);
  }

  @CanRole(['dept_director'])
  @Patch('weekly/:id/template')
  async updateWeeklyTemplate(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { templateData?: unknown },
  ): Promise<DepartmentWeeklyReport> {
    const { userId } = req.userContext;
    return this.departmentReportService.updateWeeklyTemplate(
      id,
      body.templateData,
      userId,
    );
  }

  @CanRole(['dept_director'])
  @Delete('weekly/:id')
  async removeWeekly(@Param('id') id: string): Promise<{ success: true }> {
    return this.departmentReportService.removeWeekly(id);
  }

  @Get('monthly')
  async findMonthly(
    @Query() query: DepartmentMonthlyReportQueryDto,
  ): Promise<DepartmentMonthlyReportListResponse> {
    return this.departmentReportService.findMonthly(query);
  }

  @Get('monthly/:id')
  async findMonthlyOne(
    @Param('id') id: string,
  ): Promise<DepartmentMonthlyReportDetail> {
    return this.departmentReportService.findMonthlyOne(id);
  }

  @CanRole(['dept_director'])
  @Post('monthly')
  async createMonthly(
    @Req() req: Request,
    @Body() dto: CreateDepartmentMonthlyReportDto,
  ): Promise<DepartmentMonthlyReport> {
    const { userId } = req.userContext;
    return this.departmentReportService.createMonthly(dto, userId);
  }

  @CanRole(['dept_director'])
  @Patch('monthly/:id/template')
  async updateMonthlyTemplate(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { templateData?: unknown },
  ): Promise<DepartmentMonthlyReport> {
    const { userId } = req.userContext;
    return this.departmentReportService.updateMonthlyTemplate(
      id,
      body.templateData,
      userId,
    );
  }

  @CanRole(['dept_director'])
  @Delete('monthly/:id')
  async removeMonthly(@Param('id') id: string): Promise<{ success: true }> {
    return this.departmentReportService.removeMonthly(id);
  }
}
