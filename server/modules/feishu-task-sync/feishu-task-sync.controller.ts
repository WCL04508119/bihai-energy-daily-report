import { Controller, Post } from '@nestjs/common';
import { CanRole } from '@lark-apaas/fullstack-nestjs-core';

import { FeishuTaskSyncService } from './feishu-task-sync.service';
import type { TaskPoolSyncResponse } from '@shared/api.interface';

@Controller('api/feishu-task-sync')
export class FeishuTaskSyncController {
  constructor(private readonly feishuTaskSyncService: FeishuTaskSyncService) {}

  @Post('sync')
  @CanRole(['dept_director'])
  async sync(): Promise<TaskPoolSyncResponse> {
    return this.feishuTaskSyncService.sync();
  }
}