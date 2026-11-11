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
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { DailyReportService } from './daily-report.service';
import { DataScopeService } from '../data-scope/data-scope.service';
import { CreateDailyReportDto } from './dto/create-daily-report.dto';
import { UpdateDailyReportDto } from './dto/update-daily-report.dto';
import { DailyReportQueryDto } from './dto/daily-report-query.dto';
import type {
  DailyReport,
  DailyReportListResponse,
  RecipientDefaults,
} from '@shared/api.interface';

@Controller('api/daily-reports')
export class DailyReportController {
  constructor(
    private readonly dailyReportService: DailyReportService,
    private readonly dataScope: DataScopeService,
  ) {}

  @NeedLogin()
  @Get()
  async findAll(
    @Req() req: Request,
    @Query() query: DailyReportQueryDto,
  ): Promise<DailyReportListResponse> {
    const scope = await this.dataScope.resolve(
      req.userContext.roles,
      req.userContext.userId,
    );
    const result = await this.dailyReportService.findAll(query, scope);
    return {
      ...result,
      items: result.items.map((item: DailyReport) => ({
        ...item,
        canEdit: item.reporterId === req.userContext.userId,
      })),
    };
  }

  @NeedLogin()
  @Get('recipient-defaults')
  async getRecipientDefaults(
    @Req() req: Request,
    @Query('department') department?: string,
  ): Promise<RecipientDefaults> {
    return this.dailyReportService.getRecipientDefaults(
      req.userContext.userId,
      department,
    );
  }

  @NeedLogin()
  @Get('latest-mine')
  async findLatestMine(@Req() req: Request): Promise<DailyReport | null> {
    return this.dailyReportService.findLatestMine(req.userContext.userId);
  }

  @NeedLogin()
  @Get(':id')
  async findOne(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<DailyReport> {
    const scope = await this.dataScope.resolve(
      req.userContext.roles,
      req.userContext.userId,
    );
    const report = await this.dailyReportService.findOne(id, scope);
    return {
      ...report,
      canEdit: report.reporterId === req.userContext.userId,
    };
  }

  @NeedLogin()
  @Post()
  async create(
    @Req() req: Request,
    @Body() dto: CreateDailyReportDto,
  ): Promise<DailyReport> {
    const { userId, userName } = req.userContext;
    return this.dailyReportService.create(dto, userId, userName);
  }

  @NeedLogin()
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateDailyReportDto,
  ): Promise<DailyReport> {
    const { userId, userName } = req.userContext;
    return this.dailyReportService.update(id, dto, userName, userId);
  }

  @NeedLogin()
  @Delete(':id')
  async remove(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    return this.dailyReportService.remove(id, req.userContext.userId);
  }
}
