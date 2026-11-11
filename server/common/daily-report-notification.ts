import { Logger } from '@nestjs/common';
import { CapabilityService } from '@lark-apaas/fullstack-nestjs-core';

import type { DailyReport } from '@shared/api.interface';
import type { WorkDailyReportNotificationOneInput } from '@shared/plugin-types';

const NOTIFICATION_INSTANCE_ID = 'work_daily_report_notification_1';

const MISSING_REPORTER_NAME = '（姓名未获取，请核查）';

const logger = new Logger('DailyReportNotification');

export const resolveNotificationTargets = (
  report: Pick<DailyReport, 'recipients' | 'cc'>,
): string[] => {
  const merged: string[] = [...(report.recipients ?? []), ...(report.cc ?? [])];
  const unique: string[] = [];
  for (const raw of merged) {
    if (typeof raw !== 'string') continue;
    const id = raw.trim();
    if (id.length === 0 || unique.includes(id)) continue;
    unique.push(id);
  }
  return unique;
};

export const buildDailyReportMessage = (
  report: DailyReport,
): { title: string; content: string } => {
  const resolvedName = report.reporterName?.trim() ?? '';
  const reporterName =
    resolvedName.length > 0 ? resolvedName : MISSING_REPORTER_NAME;
  const lines: string[] = [];
  lines.push(
    `**填报人：** ${reporterName}`,
    `**填报日期：** ${report.reportDate}`,
    `**所属部门：** ${report.department}`,
    `**任务来源：** ${report.taskSource}`,
    `**任务名称：** ${report.taskName}`,
  );
  if (report.projectName && report.projectName.length > 0) {
    lines.push(`**项目名称：** ${report.projectName.join('、')}`);
  }
  if (report.projectCode && report.projectCode.length > 0) {
    lines.push(`**项目编号：** ${report.projectCode.join('、')}`);
  }
  if (report.plmTask) {
    lines.push(`**PLM任务：** ${report.plmTask}`);
  }
  if (report.dayCompletion) {
    lines.push(`**当日完成情况：** ${report.dayCompletion}`);
  }
  if (report.assistanceNeeded) {
    lines.push(`**需协助事项：** ${report.assistanceNeeded}`);
  }
  const titleHead = `【日报】${reporterName} · ${report.taskName}`;
  return {
    title: titleHead.slice(0, 50),
    content: lines.join('\n'),
  };
};

export const sendDailyReportNotification = async (
  capabilityService: CapabilityService,
  report: DailyReport,
  targetIds: string[],
): Promise<void> => {
  if (targetIds.length === 0) return;
  const { title, content } = buildDailyReportMessage(report);
  const input: WorkDailyReportNotificationOneInput = {
    title,
    content,
    receiverIds: targetIds,
  };
  const result = (await capabilityService
    .load(NOTIFICATION_INSTANCE_ID)
    .call('send_feishu_message', input)) as { success?: boolean } | undefined;
  if (!result || !result.success) {
    throw new Error('飞书消息发送未成功');
  }
  logger.log(
    `日报通知已发送 id=${report.id} 接收人 ${targetIds.length} 位 标题=${title}`,
  );
};
