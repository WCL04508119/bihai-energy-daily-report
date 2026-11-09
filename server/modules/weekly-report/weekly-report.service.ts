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
import { eq, and, desc, gte, lte, count, sql } from 'drizzle-orm';
import { weeklyReports, dailyReports } from '../../database/schema';
import type {
  WeeklyReport,
  WeeklyReportListResponse,
  DailyReport,
} from '@shared/api.interface';
import { parseWeeklyTemplateData } from '@shared/api.interface';
import { WeeklyReportQueryDto } from './dto/weekly-report-query.dto';

type WeeklyReportRow = typeof weeklyReports.$inferSelect;
type DailyReportRow = typeof dailyReports.$inferSelect;

function mapWeeklyRow(row: WeeklyReportRow): WeeklyReport {
  return {
    id: row.id,
    weekStart: String(row.weekStart),
    weekEnd: String(row.weekEnd),
    department: row.department as WeeklyReport['department'],
    summaryContent: row.summaryContent ?? undefined,
    totalWorkHours: Number(row.totalWorkHours),
    completionRate: Number(row.completionRate),
    reportCount: row.reportCount,
    reporterId: row.reporterId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    templateData: parseWeeklyTemplateData(row.templateData),
  };
}

function mapDailyRow(row: DailyReportRow): DailyReport {
  return {
    id: row.id,
    reportDate: String(row.reportDate),
    department: row.department as DailyReport['department'],
    taskSource: row.taskSource as DailyReport['taskSource'],
    taskName: row.taskName,
    projectName: row.projectName ?? undefined,
    projectCode: row.projectCode ?? undefined,
    plmTask: row.plmTask ?? undefined,
    dayCompletion: row.dayCompletion ?? undefined,
    outputFileCount: row.outputFileCount,
    assistanceNeeded: row.assistanceNeeded ?? undefined,
    reporterId: row.reporterId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class WeeklyReportService {
  private readonly logger = new Logger(WeeklyReportService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async findAll(
    query: WeeklyReportQueryDto,
  ): Promise<WeeklyReportListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (query.department) {
      conditions.push(eq(weeklyReports.department, query.department));
    }
    if (query.reporterId) {
      conditions.push(
        sql`(${weeklyReports.reporterId}).user_id = ${query.reporterId}`,
      );
    }
    if (query.weekStart) {
      conditions.push(eq(weeklyReports.weekStart, query.weekStart));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const [itemsResult, countResult] = await Promise.all([
      this.db
        .select()
        .from(weeklyReports)
        .where(whereClause)
        .orderBy(desc(weeklyReports.weekStart))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(weeklyReports)
        .where(whereClause),
    ]);

    const items: WeeklyReport[] = itemsResult.map((row: WeeklyReportRow) =>
      mapWeeklyRow(row),
    );
    const total = countResult[0]?.count ?? 0;

    return { items, total, page, pageSize };
  }

  async findOne(id: string): Promise<WeeklyReport> {
    const result = await this.db
      .select()
      .from(weeklyReports)
      .where(eq(weeklyReports.id, id))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('周报不存在');
    }

    const weekly = mapWeeklyRow(result[0]);

    // 查询关联的日报列表
    const dailyResult = await this.db
      .select()
      .from(dailyReports)
      .where(
        and(
          sql`(${dailyReports.reporterId}).user_id = ${weekly.reporterId}`,
          gte(dailyReports.reportDate, weekly.weekStart),
          lte(dailyReports.reportDate, weekly.weekEnd),
        ),
      )
      .orderBy(desc(dailyReports.reportDate));

    weekly.dailyReports = dailyResult.map((row: DailyReportRow) =>
      mapDailyRow(row),
    );

    return weekly;
  }

  async generate(
    weekStart: string,
    reporterId: string,
  ): Promise<WeeklyReport> {
    if (!weekStart) {
      throw new BadRequestException('周开始日期不能为空');
    }

    const weekEnd = addDays(weekStart, 6);

    // 查询该用户本周所有日报
    const dailyResult = await this.db
      .select()
      .from(dailyReports)
      .where(
        and(
          sql`(${dailyReports.reporterId}).user_id = ${reporterId}`,
          gte(dailyReports.reportDate, weekStart),
          lte(dailyReports.reportDate, weekEnd),
        ),
      )
      .orderBy(dailyReports.reportDate);

    if (dailyResult.length === 0) {
      throw new BadRequestException('该时间段内没有日报数据');
    }

    // 工时/完成率数据源已随日报字段下线，汇总值固定记 0
    const department = dailyResult[0].department;

    // 检查是否已有周报
    const existing = await this.db
      .select()
      .from(weeklyReports)
      .where(
        and(
          sql`(${weeklyReports.reporterId}).user_id = ${reporterId}`,
          eq(weeklyReports.weekStart, weekStart),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // 更新
      const updated = await this.db
        .update(weeklyReports)
        .set({
          weekEnd,
          department,
          totalWorkHours: '0',
          completionRate: '0',
          reportCount: dailyResult.length,
        })
        .where(eq(weeklyReports.id, existing[0].id))
        .returning();

      return mapWeeklyRow(updated[0]);
    } else {
      // 创建
      const inserted = await this.db
        .insert(weeklyReports)
        .values({
          weekStart,
          weekEnd,
          department,
          totalWorkHours: '0',
          completionRate: '0',
          reportCount: dailyResult.length,
          reporterId,
        })
        .returning();

      return mapWeeklyRow(inserted[0]);
    }
  }

  async updateTemplate(
    id: string,
    templateData: unknown,
    userId: string,
  ): Promise<WeeklyReport> {
    const parsed = parseWeeklyTemplateData(templateData);
    if (!parsed) {
      throw new BadRequestException('模板数据格式不正确');
    }

    const updated = await this.db
      .update(weeklyReports)
      .set({ templateData: parsed, updatedAt: new Date(), updatedBy: userId })
      .where(eq(weeklyReports.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('周报不存在');
    }

    return mapWeeklyRow(updated[0]);
  }
}
