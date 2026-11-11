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
import { MonthlyReportService } from './monthly-report.service';
import { DataScopeService } from '../data-scope/data-scope.service';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';
import type {
  MonthlyReport,
  MonthlyReportListResponse,
} from '@shared/api.interface';

@Controller('api/monthly-reports')
export class MonthlyReportController {
  constructor(
    private readonly monthlyReportService: MonthlyReportService,
    private readonly dataScope: DataScopeService,
  ) {}

  @NeedLogin()
  @Get()
  async findAll(
    @Req() req: Request,
    @Query() query: MonthlyReportQueryDto,
  ): Promise<MonthlyReportListResponse> {
    const scope = await this.dataScope.resolve(
      req.userContext.roles,
      req.userContext.userId,
    );
    return this.monthlyReportService.findAll(query, scope);
  }

  @NeedLogin()
  @Get(':id')
  async findOne(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<MonthlyReport> {
    const scope = await this.dataScope.resolve(
      req.userContext.roles,
      req.userContext.userId,
    );
    return this.monthlyReportService.findOne(id, scope);
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
    const scope = await this.dataScope.resolve(
      req.userContext.roles,
      userId,
    );
    const targetId = body.reporterId || userId;
    if (targetId !== userId && scope.kind === 'self') {
      throw new ForbiddenException('只能生成本人的月报');
    }
    return this.monthlyReportService.generate(body.reportMonth, targetId);
  }
}
