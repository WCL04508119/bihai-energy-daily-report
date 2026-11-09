import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, gte, lte, count } from 'drizzle-orm';
import { dailyReports } from '../../database/schema';
import type {
  DailyReport,
  DailyReportListResponse,
  DailyCompletionRow,
} from '@shared/api.interface';
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
      projectNames: Array.isArray(item.projectNames)
        ? item.projectNames.filter((n: unknown): n is string => typeof n === 'string')
        : [],
      projectCodes: Array.isArray(item.projectCodes)
        ? item.projectCodes.filter((c: unknown): c is string => typeof c === 'string')
        : [],
      completion: typeof item.completion === 'string' ? item.completion : undefined,
    }));
}

function mapRow(row: DailyReportRow): DailyReport {
  return {
    id: row.id,
    reportDate: String(row.reportDate),
    department: row.department as DailyReport['department'],
    taskSource: row.taskSource as DailyReport['taskSource'],
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
  ) {}

  async findAll(query: DailyReportQueryDto): Promise<DailyReportListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
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

    return {
      items: rows.map((row: DailyReportRow) => mapRow(row)),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string): Promise<DailyReport> {
    const rows = await this.db
      .select()
      .from(dailyReports)
      .where(eq(dailyReports.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('日报不存在');
    }

    return mapRow(rows[0]);
  }

  async create(
    dto: CreateDailyReportDto,
    reporterId: string,
    userName: string,
  ): Promise<DailyReport> {
    const insertData: typeof dailyReports.$inferInsert = {
      reportDate: dto.reportDate,
      department: dto.department,
      taskSource: dto.taskSource,
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
    return { ...created, reporterName: userName };
  }

  async update(
    id: string,
    dto: UpdateDailyReportDto,
    userName: string,
  ): Promise<DailyReport> {
    const patch: Partial<typeof dailyReports.$inferInsert> = {};
    if (dto.reportDate !== undefined) patch.reportDate = dto.reportDate;
    if (dto.department !== undefined) patch.department = dto.department;
    if (dto.taskSource !== undefined) patch.taskSource = dto.taskSource;
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

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = await this.db
      .update(dailyReports)
      .set(patch)
      .where(eq(dailyReports.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('日报不存在');
    }

    const updatedRow = mapRow(updated[0]);
    return { ...updatedRow, reporterName: userName };
  }

  async remove(id: string): Promise<{ success: true }> {
    const deleted = await this.db
      .delete(dailyReports)
      .where(eq(dailyReports.id, id))
      .returning({ id: dailyReports.id });

    if (deleted.length === 0) {
      throw new NotFoundException('日报不存在');
    }

    return { success: true };
  }
}
