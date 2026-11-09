import { Module } from '@nestjs/common';

import { FeishuTaskSyncController } from './feishu-task-sync.controller';
import { FeishuTaskSyncService } from './feishu-task-sync.service';
import { FeishuTaskSyncAutomation } from './feishu-task-sync.automation';

@Module({
  controllers: [FeishuTaskSyncController],
  providers: [FeishuTaskSyncService, FeishuTaskSyncAutomation],
})
export class FeishuTaskSyncModule {}