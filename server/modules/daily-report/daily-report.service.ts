import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  AuthNPaasService,
  CapabilityService,
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, gte, lte, count, inArray } from 'drizzle-orm';
import { dailyReports } from '../../database/schema';
import type { DataScope } from '../data-scope/data-scope.service';
import {
  resolveNotificationTargets,
  sendDailyReportNotification,
} from '../../common/daily-report-notification';
import type {
  DailyReport,
  DailyReportListResponse,
  DailyCompletionRow,
  RecipientDefaults,
} from '@shared/api.interface';
import { isTaskSource, resolveDirectorDepartment } from '@shared/api.interface';
import { CreateDailyReportDto } from './dto/create-daily-report.dto';
import { UpdateDailyReportDto } from './dto/update-daily-report.dto';
import { DailyReportQueryDto } from './dto/daily-report-query.dto';

type DailyReportRow = typeof dailyReports.$inferSelect;

function parseCompletionRows(
  raw: unknown,
): DailyCompletionRow[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((item): item is Record<string, unknown> =>
      !!item && typeof item === 'object',
    )
    .map((item) => ({
      kind:
        item.kind === 'routine' || item.kind === 'project'
          ? item.kind
          : undefined,
      projectNames: Array.isArray(item.projectNames)
        ? item.projectNames.filter((n: unknown): n is string => typeof n === 'string')
        : [],
      projectCodes: Array.isArray(item.projectCodes)
        ? item.projectCodes.filter((c: unknown): c is string => typeof c === 'string')
        : [],
      completion: typeof item.completion === 'string' ? item.completion : undefined,
      workHours:
        typeof item.workHours === 'string' && item.workHours.trim()
          ? item.workHours.trim()
          : typeof item.workHours === 'number'
            ? String(item.workHours)
            : undefined,
    }));
}

function assertTaskSources(sources: string[] | undefined): void {
  if (!sources) return;
  const invalid = sources.find((source: string) => !isTaskSource(source));
  if (invalid !== undefined) {
    throw new BadRequestException(`任务来源无效：${invalid}`);
  }
}

function mapRow(row: DailyReportRow): DailyReport {
  const storedSources = (row.taskSources ?? []).filter(
    (source: string): source is DailyReport['taskSource'] =>
      isTaskSource(source),
  );
  return {
    id: row.id,
    reportDate: String(row.reportDate),
    department: row.department as DailyReport['department'],
    taskSource: row.taskSource as DailyReport['taskSource'],
    taskSources:
      storedSources.length > 0
        ? storedSources
        : [row.taskSource as DailyReport['taskSource']],
    taskName: row.taskName,
    projectName: (row.projectName ?? []).filter((name: string) => name.trim().length > 0),
    projectCode: (row.projectCode ?? []).filter((code: string) => code.trim().length > 0),
    plmTask: row.plmTask ?? undefined,
    completionRows: parseCompletionRows(row.completionRows),
    dayCompletion: row.dayCompletion ?? undefined,
    outputFileCount: row.outputFileCount,
    assistanceNeeded: row.assistanceNeeded ?? undefined,
    reporterId: row.reporterId,
    recipients: row.recipients ?? undefined,
    cc: row.cc ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class DailyReportService {
  private readonly logger = new Logger(DailyReportService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    @Inject(CapabilityService)
    private readonly capabilityService: CapabilityService,
    private readonly authNPaasService: AuthNPaasService,
  ) {}

  async findAll(
    query: DailyReportQueryDto,
    scope: DataScope,
  ): Promise<DailyReportListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (scope.kind === 'self') {
      conditions.push(eq(dailyReports.reporterId, scope.userId));
    } else if (scope.kind === 'department') {
      conditions.push(inArray(dailyReports.department, scope.departments));
    }
    if (query.department) {
      conditions.push(eq(dailyReports.department, query.department));
    }
    if (query.startDate) {
      conditions.push(gte(dailyReports.reportDate, query.startDate));
    }
    if (query.endDate) {
      conditions.push(lte(dailyReports.reportDate, query.endDate));
    }
    if (query.reporterId) {
      conditions.push(eq(dailyReports.reporterId, query.reporterId));
    }
    const keyword = query.keyword?.trim();
    if (keyword) {
      const matchedIds = await this.matchReporterIdsByKeyword(keyword, scope);
      if (matchedIds.length === 0) {
        return { items: [], total: 0, page, pageSize };
      }
      conditions.push(inArray(dailyReports.reporterId, matchedIds));
    }

    const whereClause = conditions.length > 0
      ? and(...conditions)
      : undefined;

    const [countResult, rows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(dailyReports)
        .where(whereClause),
      this.db
        .select()
        .from(dailyReports)
        .where(whereClause)
        .orderBy(desc(dailyReports.reportDate))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    const reporterNames = await this.resolveNames(
      rows.map((row: DailyReportRow) => row.reporterId),
    );

    return {
      items: rows.map((row: DailyReportRow) => ({
        ...mapRow(row),
        reporterName: reporterNames.get(row.reporterId),
      })),
      total,
      page,
      pageSize,
    };
  }

  private async resolveNames(userIds: string[]): Promise<Map<string, string>> {
    const uniqueIds: string[] = Array.from(new Set(userIds));
    const names = new Map<string, string>();
    if (uniqueIds.length === 0) return names;
    try {
      const infos = await this.authNPaasService.listUsersByIds(uniqueIds);
      infos.forEach((info, index: number) => {
        if (!info) return;
        const name = info.name?.zh_cn ?? info.name?.en_us ?? '';
        if (!name) return;
        const fallbackId = uniqueIds[index];
        const resolvedId = info.miaodaUserID || fallbackId;
        if (!resolvedId) return;
        if (info.miaodaUserID && fallbackId && info.miaodaUserID !== fallbackId) {
          this.logger.warn(
            `姓名解析返回顺序与入参不一致：入参 ${fallbackId}，返回 ${info.miaodaUserID}（按返回 ID 归属）`,
          );
        }
        names.set(resolvedId, name);
      });
    } catch (error) {
      this.logger.warn(
        '日报填报人姓名解析失败，将不展示姓名',
        error instanceof Error ? error.stack : String(error),
      );
    }
    return names;
  }

  private async matchReporterIdsByKeyword(
    keyword: string,
    scope: DataScope,
  ): Promise<string[]> {
    const scopeConditions = [];
    if (scope.kind === 'self') {
      scopeConditions.push(eq(dailyReports.reporterId, scope.userId));
    } else if (scope.kind === 'department') {
      scopeConditions.push(inArray(dailyReports.department, scope.departments));
    }
    const rows: { reporterId: string }[] = await this.db
      .selectDistinct({ reporterId: dailyReports.reporterId })
      .from(dailyReports)
      .where(scopeConditions.length > 0 ? and(...scopeConditions) : undefined);
    const ids: string[] = rows.map((row: { reporterId: string }) => row.reporterId);
    if (ids.length === 0) return [];
    const names = await this.resolveNames(ids);
    return ids.filter((id: string) =>
      (names.get(id) ?? '').includes(keyword),
    );
  }

  async getRecipientDefaults(
    userId: string,
    department?: string,
  ): Promise<RecipientDefaults> {
    const ownRows = await this.db
      .select({
        recipients: dailyReports.recipients,
        cc: dailyReports.cc,
      })
      .from(dailyReports)
      .where(eq(dailyReports.reporterId, userId))
      .orderBy(desc(dailyReports.reportDate), desc(dailyReports.createdAt))
      .limit(20);

    const own = ownRows.find(
      (row) => (row.recipients ?? []).length > 0,
    );
    if (own) {
      return {
        recipients: own.recipients ?? [],
        cc: own.cc ?? [],
        source: 'self',
      };
    }

    if (!department) {
      return { recipients: [], cc: [], source: 'none' };
    }

    const deptRows = await this.db
      .select({
        recipients: dailyReports.recipients,
        cc: dailyReports.cc,
      })
      .from(dailyReports)
      .where(eq(dailyReports.department, department))
      .orderBy(desc(dailyReports.reportDate), desc(dailyReports.createdAt))
      .limit(20);

    const dept = deptRows.find(
      (row) => (row.recipients ?? []).length > 0,
    );
    if (dept) {
      return {
        recipients: dept.recipients ?? [],
        cc: dept.cc ?? [],
        source: 'department',
      };
    }

    return { recipients: [], cc: [], source: 'none' };
  }

  async findLatestMine(userId: string): Promise<DailyReport | null> {
    const rows = await this.db
      .select()
      .from(dailyReports)
      .where(eq(dailyReports.reporterId, userId))
      .orderBy(desc(dailyReports.reportDate), desc(dailyReports.createdAt))
      .limit(1);

    if (rows.length === 0) return null;
    return mapRow(rows[0]);
  }

  async findOne(id: string, scope: DataScope): Promise<DailyReport> {
    const rows = await this.db
      .select()
      .from(dailyReports)
      .where(eq(dailyReports.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('日报不存在');
    }

    this.assertVisible(rows[0], scope);
    return mapRow(rows[0]);
  }

  private assertVisible(row: DailyReportRow, scope: DataScope): void {
    if (scope.kind === 'all') return;
    if (row.reporterId === scope.userId) return;
    if (
      scope.kind === 'department' &&
      scope.departments.includes(row.department)
    ) {
      return;
    }
    throw new ForbiddenException('无权查看该日报');
  }

  async create(
    dto: CreateDailyReportDto,
    reporterId: string,
    userName: string,
    options: { notify?: boolean } = {},
  ): Promise<DailyReport> {
    assertTaskSources(dto.taskSources);
    const insertData: typeof dailyReports.$inferInsert = {
      reportDate: dto.reportDate,
      department:
        resolveDirectorDepartment(reporterId) ?? dto.department,
      taskSource: dto.taskSource,
      taskSources: dto.taskSources ?? [dto.taskSource],
      taskName: dto.taskName,
      projectName: dto.projectName ?? [],
      projectCode: dto.projectCode ?? [],
      plmTask: dto.plmTask,
      completionRows: dto.completionRows,
      dayCompletion: dto.dayCompletion,
      outputFileCount: dto.outputFileCount,
      assistanceNeeded: dto.assistanceNeeded,
      recipients: dto.recipients ?? [],
      cc: dto.cc ?? [],
      reporterId,
    };

    const inserted = await this.db
      .insert(dailyReports)
      .values(insertData)
      .returning();

    const created = mapRow(inserted[0]);
    const reporterName =
      userName?.trim() ||
      (await this.resolveNames([reporterId])).get(reporterId) ||
      '';
    if (options.notify !== false) {
      await this.notifyRecipients({ ...created, reporterName });
    }
    return { ...created, reporterName };
  }

  private async notifyRecipients(report: DailyReport): Promise<void> {
    const targets = resolveNotificationTargets(report);
    if (targets.length === 0) {
      this.logger.warn(`日报无汇报/抄送人，跳过通知 id=${report.id}`);
      return;
    }
    if (!report.reporterName?.trim()) {
      this.logger.error(
        `日报通知缺少填报人姓名 id=${report.id} reporterId=${report.reporterId}`,
      );
    }
    try {
      await sendDailyReportNotification(
        this.capabilityService,
        report,
        targets,
      );
    } catch (error) {
      this.logger.warn(
        `日报通知发送失败 id=${report.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async update(
    id: string,
    dto: UpdateDailyReportDto,
    userName: string,
    actorId: string,
  ): Promise<DailyReport> {
    assertTaskSources(dto.taskSources);
    const existing = await this.db
      .select({ reporterId: dailyReports.reporterId })
      .from(dailyReports)
      .where(eq(dailyReports.id, id))
      .limit(1);
    if (existing.length === 0) {
      throw new NotFoundException('日报不存在');
    }
    if (existing[0].reporterId !== actorId) {
      throw new ForbiddenException('只能修改本人的日报');
    }
    const patch: Partial<typeof dailyReports.$inferInsert> = {};
    if (dto.reportDate !== undefined) patch.reportDate = dto.reportDate;
    if (dto.department !== undefined) patch.department = dto.department;
    if (dto.taskSource !== undefined) patch.taskSource = dto.taskSource;
    if (dto.taskSources !== undefined) patch.taskSources = dto.taskSources;
    if (dto.taskName !== undefined) patch.taskName = dto.taskName;
    if (dto.projectName !== undefined) patch.projectName = dto.projectName;
    if (dto.projectCode !== undefined) patch.projectCode = dto.projectCode;
    if (dto.plmTask !== undefined) patch.plmTask = dto.plmTask;
    if (dto.completionRows !== undefined) patch.completionRows = dto.completionRows;
    if (dto.dayCompletion !== undefined) patch.dayCompletion = dto.dayCompletion;
    if (dto.outputFileCount !== undefined) {
      patch.outputFileCount = dto.outputFileCount;
    }
    if (dto.assistanceNeeded !== undefined) {
      patch.assistanceNeeded = dto.assistanceNeeded;
    }
    if (dto.recipients !== undefined) patch.recipients = dto.recipients;
    if (dto.cc !== undefined) patch.cc = dto.cc;

    const directorDepartment = resolveDirectorDepartment(
      existing[0].reporterId,
    );
    if (directorDepartment) patch.department = directorDepartment;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = await this.db
      .update(dailyReports)
      .set(patch)
      .where(
        and(
          eq(dailyReports.id, id),
          eq(dailyReports.reporterId, actorId),
        ),
      )
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('日报不存在');
    }

    const updatedRow = mapRow(updated[0]);
    return { ...updatedRow, reporterName: userName };
  }

  async remove(id: string, actorId: string): Promise<{ success: true }> {
    const deleted = await this.db
      .delete(dailyReports)
      .where(
        and(
          eq(dailyReports.id, id),
          eq(dailyReports.reporterId, actorId),
        ),
      )
      .returning({ id: dailyReports.id });

    if (deleted.length === 0) {
      const exists = await this.db
        .select({ id: dailyReports.id })
        .from(dailyReports)
        .where(eq(dailyReports.id, id))
        .limit(1);
      if (exists.length > 0) {
        throw new ForbiddenException('只能删除本人的日报');
      }
      throw new NotFoundException('日报不存在');
    }

    return { success: true };
  }
}
