import { Logger } from '@nestjs/common';
import { Automation, BindTrigger } from '@lark-apaas/fullstack-nestjs-core';

import { FeishuTaskSyncService } from './feishu-task-sync.service';

@Automation()
export class FeishuTaskSyncAutomation {
  private readonly logger = new Logger(FeishuTaskSyncAutomation.name);

  constructor(private readonly feishuTaskSyncService: FeishuTaskSyncService) {}

  @BindTrigger('feishu_task_sync_cron')
  async run(): Promise<void> {
    try {
      await this.feishuTaskSyncService.sync();
    } catch (error) {
      this.logger.error('飞书任务定时同步失败', error);
    }
  }
}