import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';

import { ScheduledSendService } from './scheduled-send.service';
import { CreateScheduledSendDto } from './dto/create-scheduled-send.dto';
import type {
  ScheduledReportSend,
  ScheduledSendListResponse,
} from '@shared/api.interface';

@Controller('api/scheduled-report-sends')
@NeedLogin()
export class ScheduledSendController {
  constructor(
    private readonly scheduledSendService: ScheduledSendService,
  ) {}

  @Post()
  async create(
    @Req() req: Request,
    @Body() dto: CreateScheduledSendDto,
  ): Promise<ScheduledReportSend> {
    const { userId } = req.userContext;
    return this.scheduledSendService.create(dto, userId);
  }

  @Get('mine')
  async findMine(@Req() req: Request): Promise<ScheduledSendListResponse> {
    const { userId } = req.userContext;
    return this.scheduledSendService.findMine(userId);
  }

  @Delete(':id')
  async cancel(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    const { userId } = req.userContext;
    return this.scheduledSendService.cancel(id, userId);
  }
}
