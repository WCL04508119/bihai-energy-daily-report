import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';

import { FeishuTaskSyncService } from './feishu-task-sync.service';
import { DataScopeService } from '../data-scope/data-scope.service';
import type {
  FeishuAuthBindRequest,
  FeishuAuthStatusResponse,
  FeishuAuthUrlResponse,
  TaskPoolSyncResponse,
} from '@shared/api.interface';

@Controller('api/feishu-task-sync')
export class FeishuTaskSyncController {
  constructor(
    private readonly feishuTaskSyncService: FeishuTaskSyncService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get('auth-url')
  @NeedLogin()
  getAuthUrl(
    @Query('redirectUri') redirectUri: string,
    @Query('state') state: string,
  ): FeishuAuthUrlResponse {
    return {
      url: this.feishuTaskSyncService.buildAuthUrl(redirectUri, state ?? ''),
    };
  }

  @Post('oauth-bind')
  @NeedLogin()
  async bindAuthorization(
    @Req() req: Request,
    @Body() body: FeishuAuthBindRequest,
  ): Promise<FeishuAuthStatusResponse> {
    const { userId } = req.userContext;
    return this.feishuTaskSyncService.bindAuthorization(
      userId,
      body.code,
      body.redirectUri,
    );
  }

  @Get('auth-status')
  @NeedLogin()
  async getAuthStatus(@Req() req: Request): Promise<FeishuAuthStatusResponse> {
    return this.feishuTaskSyncService.getAuthStatus(req.userContext.userId);
  }

  @Post('sync')
  @NeedLogin()
  async sync(@Req() req: Request): Promise<TaskPoolSyncResponse> {
    const { userId, roles } = req.userContext;
    const context = await this.dataScopeService.resolveContext(
      roles ?? undefined,
      userId,
    );
    return this.feishuTaskSyncService.sync(
      userId,
      context.features.canManageTaskPool,
    );
  }
}
