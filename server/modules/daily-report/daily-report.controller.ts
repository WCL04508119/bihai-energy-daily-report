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
import { CreateDailyReportDto } from './dto/create-daily-report.dto';
import { UpdateDailyReportDto } from './dto/update-daily-report.dto';
import { DailyReportQueryDto } from './dto/daily-report-query.dto';
import type {
  DailyReport,
  DailyReportListResponse,
} from '@shared/api.interface';

@Controller('api/daily-reports')
export class DailyReportController {
  constructor(private readonly dailyReportService: DailyReportService) {}

  @Get()
  async findAll(
    @Query() query: DailyReportQueryDto,
  ): Promise<DailyReportListResponse> {
    return this.dailyReportService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<DailyReport> {
    return this.dailyReportService.findOne(id);
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
    const { userName } = req.userContext;
    return this.dailyReportService.update(id, dto, userName);
  }

  @NeedLogin()
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ success: true }> {
    return this.dailyReportService.remove(id);
  }
}
