import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { WeeklyReportService } from './weekly-report.service';
import { DataScopeService } from '../data-scope/data-scope.service';
import { WeeklyReportQueryDto } from './dto/weekly-report-query.dto';
import type {
  WeeklyReport,
  WeeklyReportListResponse,
} from '@shared/api.interface';

@Controller('api/weekly-reports')
export class WeeklyReportController {
  constructor(
    private readonly weeklyReportService: WeeklyReportService,
    private readonly dataScope: DataScopeService,
  ) {}

  @NeedLogin()
  @Get()
  async findAll(
    @Req() req: Request,
    @Query() query: WeeklyReportQueryDto,
  ): Promise<WeeklyReportListResponse> {
    const scope = await this.dataScope.resolve(
      req.userContext.roles,
      req.userContext.userId,
    );
    return this.weeklyReportService.findAll(query, scope);
  }

  @NeedLogin()
  @Get(':id')
  async findOne(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<WeeklyReport> {
    const scope = await this.dataScope.resolve(
      req.userContext.roles,
      req.userContext.userId,
    );
    return this.weeklyReportService.findOne(id, scope);
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
    const scope = await this.dataScope.resolve(
      req.userContext.roles,
      userId,
    );
    const targetId = body.reporterId || userId;
    if (targetId !== userId && scope.kind === 'self') {
      throw new ForbiddenException('只能生成本人的周报');
    }
    return this.weeklyReportService.generate(body.weekStart, targetId);
  }
}
