import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { MonthlyReportService } from './monthly-report.service';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';
import type {
  MonthlyReport,
  MonthlyReportListResponse,
} from '@shared/api.interface';

@Controller('api/monthly-reports')
export class MonthlyReportController {
  constructor(
    private readonly monthlyReportService: MonthlyReportService,
  ) {}

  @Get()
  async findAll(
    @Query() query: MonthlyReportQueryDto,
  ): Promise<MonthlyReportListResponse> {
    return this.monthlyReportService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<MonthlyReport> {
    return this.monthlyReportService.findOne(id);
  }

  @NeedLogin()
  @Patch(':id/template')
  async updateTemplate(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { templateData?: unknown },
  ): Promise<MonthlyReport> {
    const { userId } = req.userContext;
    return this.monthlyReportService.updateTemplate(
      id,
      body.templateData,
      userId,
    );
  }

  @NeedLogin()
  @Post('generate')
  async generate(
    @Req() req: Request,
    @Body() body: { reportMonth: string; reporterId?: string },
  ): Promise<MonthlyReport> {
    const { userId } = req.userContext;
    const reporterId = body.reporterId || userId;
    return this.monthlyReportService.generate(body.reportMonth, reporterId);
  }
}
