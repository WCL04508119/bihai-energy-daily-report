import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthNPaasService,
  CapabilityService,
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { and, asc, desc, eq, lte } from 'drizzle-orm';

import { scheduledReportSends } from '../../database/schema';
import {
  resolveNotificationTargets,
  sendDailyReportNotification,
} from '../../common/daily-report-notification';
import { syncDailyReportToBitable } from '../../common/daily-bitable-sync';
import { DailyReportService } from '../daily-report/daily-report.service';
import { CreateDailyReportDto } from '../daily-report/dto/create-daily-report.dto';
import type { CreateScheduledSendDto } from './dto/create-scheduled-send.dto';
import {
  isDepartment,
  isScheduledSendStatus,
  isTaskSource,
  type CreateDailyReportRequest,
  type ScheduledReportSend,
  type ScheduledSendListResponse,
} from '@shared/api.interface';

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const SEND_TIME_PATTERN = /^([01]\d|2[0-3]):(00|30)$/;
const SEND_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PROCESS_BATCH_LIMIT = 50;

type ScheduledSendRow = typeof scheduledReportSends.$inferSelect;

const asText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;

const asTextArray = (value: unknown): string[] | undefined => {
  const raw: unknown[] = Array.isArray(value) ? value : [];
  const items: string[] = raw.filter(
    (item: unknown): item is string =>
      typeof item === 'string' && item.trim().length > 0,
  );
  return items.length > 0 ? items : undefined;
};

const outputCountText = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return '';
};

const parseReportPayload = (
  value: unknown,
): CreateDailyReportRequest | null => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const reportDate = asText(record.reportDate);
  const department = asText(record.department);
  const taskSource = asText(record.taskSource);
  const taskName = asText(record.taskName);
  if (
    !reportDate ||
    !department ||
    !taskSource ||
    !taskName ||
    !isDepartment(department) ||
    !isTaskSource(taskSource)
  ) {
    return null;
  }
  return {
    reportDate,
    department,
    taskSource,
    taskName,
    projectName: asTextArray(record.projectName),
    projectCode: asTextArray(record.projectCode),
    plmTask: asText(record.plmTask),
    dayCompletion: asText(record.dayCompletion),
    outputFileCount: outputCountText(record.outputFileCount),
    assistanceNeeded: asText(record.assistanceNeeded),
  };
};

const parseRecipientIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
};

@Injectable()
export class ScheduledSendService {
  private readonly logger = new Logger(ScheduledSendService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    @Inject(CapabilityService)
    private readonly capabilityService: CapabilityService,
    private readonly dailyReportService: DailyReportService,
    private readonly authNPaasService: AuthNPaasService,
  ) {}

  private mapRow(row: ScheduledSendRow): ScheduledReportSend {
    return {
      id: row.id,
      senderId: row.senderId,
      sendAt: row.sendAt.toISOString(),
      report: parseReportPayload(row.reportPayload) as CreateDailyReportRequest,
      recipientIds: parseRecipientIds(row.recipientIds),
      status: isScheduledSendStatus(row.status) ? row.status : 'failed',
      sentAt: row.sentAt ? row.sentAt.toISOString() : undefined,
      errorMsg: row.errorMsg ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async create(
    dto: CreateScheduledSendDto,
    senderId: string,
  ): Promise<ScheduledReportSend> {
    if (!SEND_DATE_PATTERN.test(dto.sendDate)) {
      throw new BadRequestException('发送日期格式不正确');
    }
    if (!SEND_TIME_PATTERN.test(dto.sendTime)) {
      throw new BadRequestException('发送时间仅支持整点或半点');
    }
    const today = new Date(
      Date.now() + SHANGHAI_OFFSET_MS,
    ).toISOString().slice(0, 10);
    if (dto.sendDate !== today) {
      throw new BadRequestException('仅支持设置当天自动发送');
    }
    const sendAt = new Date(`${dto.sendDate}T${dto.sendTime}:00+08:00`);
    if (sendAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        '所选发送时间已过，请选择之后的时间',
      );
    }
    if (dto.recipientIds && dto.recipientIds.length === 0) {
      throw new BadRequestException('接收人不能为空列表');
    }
    const recipientIds: string[] = resolveNotificationTargets(
      dto.report as CreateDailyReportRequest,
    );
    const inserted = await this.db
      .insert(scheduledReportSends)
      .values({
        senderId,
        sendAt,
        reportPayload: dto.report,
        recipientIds,
        status: 'pending',
      })
      .returning();
    return this.mapRow(inserted[0]);
  }

  async findMine(senderId: string): Promise<ScheduledSendListResponse> {
    const rows = await this.db
      .select()
      .from(scheduledReportSends)
      .where(eq(scheduledReportSends.senderId, senderId))
      .orderBy(desc(scheduledReportSends.sendAt))
      .limit(50);
    return { items: rows.map((row) => this.mapRow(row)), total: rows.length };
  }

  async cancel(id: string, senderId: string): Promise<{ success: true }> {
    const updated = await this.db
      .update(scheduledReportSends)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
        updatedBy: senderId,
      })
      .where(
        and(
          eq(scheduledReportSends.id, id),
          eq(scheduledReportSends.senderId, senderId),
          eq(scheduledReportSends.status, 'pending'),
        ),
      )
      .returning({ id: scheduledReportSends.id });
    if (updated.length === 0) {
      throw new NotFoundException('定时发送任务不存在或已不可取消');
    }
    return { success: true };
  }

  async processDue(): Promise<{
    processed: number;
    sent: number;
    failed: number;
  }> {
    const rows = await this.db
      .select()
      .from(scheduledReportSends)
      .where(
        and(
          eq(scheduledReportSends.status, 'pending'),
          lte(scheduledReportSends.sendAt, new Date()),
        ),
      )
      .orderBy(asc(scheduledReportSends.sendAt))
      .limit(PROCESS_BATCH_LIMIT);
    let sent = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await this.executeOne(row);
        sent += 1;
      } catch (error) {
        failed += 1;
        const message =
          error instanceof Error ? error.message : '未知错误';
        this.logger.error(
          `定时日报发送失败 id=${row.id}: ${message}`,
          error instanceof Error ? error.stack : undefined,
        );
        await this.db
          .update(scheduledReportSends)
          .set({
            status: 'failed',
            errorMsg: message.slice(0, 500),
            updatedAt: new Date(),
          })
          .where(eq(scheduledReportSends.id, row.id));
      }
    }
    if (rows.length > 0) {
      this.logger.log(
        `定时日报扫描完成：处理 ${rows.length} 条，成功 ${sent} 条，失败 ${failed} 条`,
      );
    }
    return { processed: rows.length, sent, failed };
  }

  private async resolveSenderName(
    userId: string,
  ): Promise<string | undefined> {
    try {
      const infos = await this.authNPaasService.listUsersByIds([userId]);
      const info =
        infos.find((item) => item?.miaodaUserID === userId) ?? infos[0];
      if (!info) return undefined;
      const name = info.name?.zh_cn ?? info.name?.en_us ?? '';
      return name.trim() ? name : undefined;
    } catch (error) {
      this.logger.warn(
        `定时日报填报人姓名解析失败 userId=${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return undefined;
    }
  }

  private async executeOne(row: ScheduledSendRow): Promise<void> {
    const payload = parseReportPayload(row.reportPayload);
    if (!payload) {
      throw new Error('日报内容数据不完整');
    }
    const stored = parseRecipientIds(row.recipientIds);
    const targets =
      stored.length > 0 ? stored : resolveNotificationTargets(payload);
    const reporterName = await this.resolveSenderName(row.senderId);
    const report = await this.dailyReportService.create(
      payload as CreateDailyReportDto,
      row.senderId,
      reporterName ?? '',
      { notify: false },
    );
    try {
      await syncDailyReportToBitable(
        this.capabilityService,
        report,
        reporterName,
      );
      this.logger.log(`定时日报已同步多维表格 id=${report.id}`);
    } catch (error) {
      this.logger.warn(
        `定时日报已创建但同步多维表格失败 id=${row.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    try {
      await sendDailyReportNotification(
        this.capabilityService,
        report,
        targets,
      );
    } catch (error) {
      const message: string =
        error instanceof Error ? error.message : '未知错误';
      this.logger.error(
        `定时日报已创建但通知发送失败 id=${row.id}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      await this.db
        .update(scheduledReportSends)
        .set({
          status: 'sent',
          sentAt: new Date(),
          errorMsg: `日报已创建，通知发送失败：${message}`.slice(0, 500),
          updatedAt: new Date(),
        })
        .where(eq(scheduledReportSends.id, row.id));
      return;
    }
    await this.db
      .update(scheduledReportSends)
      .set({
        status: 'sent',
        sentAt: new Date(),
        errorMsg: null,
        updatedAt: new Date(),
      })
      .where(eq(scheduledReportSends.id, row.id));
  }
}
