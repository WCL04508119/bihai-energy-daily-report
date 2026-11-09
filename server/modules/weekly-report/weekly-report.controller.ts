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
import { WeeklyReportService } from './weekly-report.service';
import { WeeklyReportQueryDto } from './dto/weekly-report-query.dto';
import type {
  WeeklyReport,
  WeeklyReportListResponse,
} from '@shared/api.interface';

@Controller('api/weekly-reports')
export class WeeklyReportController {
  constructor(
    private readonly weeklyReportService: WeeklyReportService,
  ) {}

  @Get()
  async findAll(
    @Query() query: WeeklyReportQueryDto,
  ): Promise<WeeklyReportListResponse> {
    return this.weeklyReportService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<WeeklyReport> {
    return this.weeklyReportService.findOne(id);
  }

  @NeedLogin()
  @Patch(':id/template')
  async updateTemplate(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { templateData?: unknown },
  ): Promise<WeeklyReport> {
    const { userId } = req.userContext;
    return this.weeklyReportService.updateTemplate(
      id,
      body.templateData,
      userId,
    );
  }

  @NeedLogin()
  @Post('generate')
  async generate(
    @Req() req: Request,
    @Body() body: { weekStart: string; reporterId?: string },
  ): Promise<WeeklyReport> {
    const { userId } = req.userContext;
    const reporterId = body.reporterId || userId;
    return this.weeklyReportService.generate(body.weekStart, reporterId);
  }
}
