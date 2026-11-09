import { Logger } from '@nestjs/common';
import {
  Automation,
  BindTrigger,
} from '@lark-apaas/fullstack-nestjs-core';

import { ScheduledSendService } from './scheduled-send.service';

@Automation()
export class ScheduledSendAutomation {
  private readonly logger = new Logger(ScheduledSendAutomation.name);

  constructor(private readonly scheduledSendService: ScheduledSendService) {}

  @BindTrigger('scheduled_report_send_cron')
  async processDueScheduledSends(): Promise<void> {
    const result = await this.scheduledSendService.processDue();
    if (result.processed > 0) {
      this.logger.log(
        `定时日报任务执行：处理 ${result.processed} 条，成功 ${result.sent} 条，失败 ${result.failed} 条`,
      );
    }
  }
}
