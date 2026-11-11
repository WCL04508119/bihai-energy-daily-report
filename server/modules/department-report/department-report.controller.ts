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
import { CanRole, NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { DepartmentReportService } from './department-report.service';
import { DataScopeService } from '../data-scope/data-scope.service';
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
    private readonly dataScope: DataScopeService,
  ) {}

  @NeedLogin()
  @Get('weekly')
  async findWeekly(
    @Req() req: Request,
    @Query() query: DepartmentWeeklyReportQueryDto,
  ): Promise<DepartmentWeeklyReportListResponse> {
    const scope = await this.dataScope.resolve(
      req.userContext.roles,
      req.userContext.userId,
    );
    return this.departmentReportService.findWeekly(query, scope);
  }

  @NeedLogin()
  @Get('weekly/:id')
  async findWeeklyOne(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<DepartmentWeeklyReportDetail> {
    const scope = await this.dataScope.resolve(
      req.userContext.roles,
      req.userContext.userId,
    );
    return this.departmentReportService.findWeeklyOne(id, scope);
  }

  @CanRole(['dept_director', 'system_admin', 'company_leader'])
  @Post('weekly')
  async createWeekly(
    @Req() req: Request,
    @Body() dto: CreateDepartmentWeeklyReportDto,
  ): Promise<DepartmentWeeklyReport> {
    const { userId } = req.userContext;
    return this.departmentReportService.createWeekly(dto, userId);
  }

  @CanRole(['dept_director', 'system_admin', 'company_leader'])
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

  @CanRole(['dept_director', 'system_admin', 'company_leader'])
  @Delete('weekly/:id')
  async removeWeekly(@Param('id') id: string): Promise<{ success: true }> {
    return this.departmentReportService.removeWeekly(id);
  }

  @NeedLogin()
  @Get('monthly')
  async findMonthly(
    @Req() req: Request,
    @Query() query: DepartmentMonthlyReportQueryDto,
  ): Promise<DepartmentMonthlyReportListResponse> {
    const scope = await this.dataScope.resolve(
      req.userContext.roles,
      req.userContext.userId,
    );
    return this.departmentReportService.findMonthly(query, scope);
  }

  @NeedLogin()
  @Get('monthly/:id')
  async findMonthlyOne(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<DepartmentMonthlyReportDetail> {
    const scope = await this.dataScope.resolve(
      req.userContext.roles,
      req.userContext.userId,
    );
    return this.departmentReportService.findMonthlyOne(id, scope);
  }

  @CanRole(['dept_director', 'system_admin', 'company_leader'])
  @Post('monthly')
  async createMonthly(
    @Req() req: Request,
    @Body() dto: CreateDepartmentMonthlyReportDto,
  ): Promise<DepartmentMonthlyReport> {
    const { userId } = req.userContext;
    return this.departmentReportService.createMonthly(dto, userId);
  }

  @CanRole(['dept_director', 'system_admin', 'company_leader'])
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

  @CanRole(['dept_director', 'system_admin', 'company_leader'])
  @Delete('monthly/:id')
  async removeMonthly(@Param('id') id: string): Promise<{ success: true }> {
    return this.departmentReportService.removeMonthly(id);
  }
}
