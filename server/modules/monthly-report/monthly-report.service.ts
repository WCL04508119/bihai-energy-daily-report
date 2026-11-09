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
import { monthlyReports, dailyReports } from '../../database/schema';
import type {
  MonthlyReport,
  MonthlyReportListResponse,
} from '@shared/api.interface';
import { parseMonthlyTemplateData } from '@shared/api.interface';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';

type MonthlyReportRow = typeof monthlyReports.$inferSelect;
type DailyReportRow = typeof dailyReports.$inferSelect;

function mapMonthlyRow(row: MonthlyReportRow): MonthlyReport {
  return {
    id: row.id,
    reportMonth: row.reportMonth,
    department: row.department as MonthlyReport['department'],
    summaryContent: row.summaryContent ?? undefined,
    totalWorkHours: Number(row.totalWorkHours),
    completionRate: Number(row.completionRate),
    reportCount: row.reportCount,
    reporterId: row.reporterId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    templateData: parseMonthlyTemplateData(row.templateData),
  };
}

function getMonthRange(reportMonth: string): { start: string; end: string } {
  const [year, month] = reportMonth.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // last day of month

  const fmt = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return { start: fmt(startDate), end: fmt(endDate) };
}

@Injectable()
export class MonthlyReportService {
  private readonly logger = new Logger(MonthlyReportService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async findAll(
    query: MonthlyReportQueryDto,
  ): Promise<MonthlyReportListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (query.department) {
      conditions.push(eq(monthlyReports.department, query.department));
    }
    if (query.reporterId) {
      conditions.push(
        sql`(${monthlyReports.reporterId}).user_id = ${query.reporterId}`,
      );
    }
    if (query.reportMonth) {
      conditions.push(eq(monthlyReports.reportMonth, query.reportMonth));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const [itemsResult, countResult] = await Promise.all([
      this.db
        .select()
        .from(monthlyReports)
        .where(whereClause)
        .orderBy(desc(monthlyReports.reportMonth))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(monthlyReports)
        .where(whereClause),
    ]);

    const items: MonthlyReport[] = itemsResult.map((row: MonthlyReportRow) =>
      mapMonthlyRow(row),
    );
    const total = countResult[0]?.count ?? 0;

    return { items, total, page, pageSize };
  }

  async findOne(id: string): Promise<MonthlyReport> {
    const result = await this.db
      .select()
      .from(monthlyReports)
      .where(eq(monthlyReports.id, id))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('月报不存在');
    }

    return mapMonthlyRow(result[0]);
  }

  async generate(
    reportMonth: string,
    reporterId: string,
  ): Promise<MonthlyReport> {
    if (!reportMonth) {
      throw new BadRequestException('月份不能为空');
    }

    const { start, end } = getMonthRange(reportMonth);

    // 查询该用户本月所有日报
    const dailyResult = await this.db
      .select()
      .from(dailyReports)
      .where(
        and(
          sql`(${dailyReports.reporterId}).user_id = ${reporterId}`,
          gte(dailyReports.reportDate, start),
          lte(dailyReports.reportDate, end),
        ),
      )
      .orderBy(dailyReports.reportDate);

    if (dailyResult.length === 0) {
      throw new BadRequestException('该时间段内没有日报数据');
    }

    // 工时/完成率数据源已随日报字段下线，汇总值固定记 0
    const department = dailyResult[0].department;

    // 检查是否已有月报
    const existing = await this.db
      .select()
      .from(monthlyReports)
      .where(
        and(
          sql`(${monthlyReports.reporterId}).user_id = ${reporterId}`,
          eq(monthlyReports.reportMonth, reportMonth),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // 更新
      const updated = await this.db
        .update(monthlyReports)
        .set({
          department,
          totalWorkHours: '0',
          completionRate: '0',
          reportCount: dailyResult.length,
        })
        .where(eq(monthlyReports.id, existing[0].id))
        .returning();

      return mapMonthlyRow(updated[0]);
    } else {
      // 创建
      const inserted = await this.db
        .insert(monthlyReports)
        .values({
          reportMonth,
          department,
          totalWorkHours: '0',
          completionRate: '0',
          reportCount: dailyResult.length,
          reporterId,
        })
        .returning();

      return mapMonthlyRow(inserted[0]);
    }
  }

  async updateTemplate(
    id: string,
    templateData: unknown,
    userId: string,
  ): Promise<MonthlyReport> {
    const parsed = parseMonthlyTemplateData(templateData);
    if (!parsed) {
      throw new BadRequestException('模板数据格式不正确');
    }

    const updated = await this.db
      .update(monthlyReports)
      .set({ templateData: parsed, updatedAt: new Date(), updatedBy: userId })
      .where(eq(monthlyReports.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('月报不存在');
    }

    return mapMonthlyRow(updated[0]);
  }
}
