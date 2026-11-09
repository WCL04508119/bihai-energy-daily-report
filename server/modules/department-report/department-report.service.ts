import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, gte, lte, count } from 'drizzle-orm';
import {
  departmentWeeklyReports,
  departmentMonthlyReports,
  dailyReports,
} from '../../database/schema';
import { TASK_SOURCES } from '@shared/api.interface';
import {
  parseWeeklyTemplateData,
  parseMonthlyTemplateData,
} from '@shared/api.interface';
import type {
  DailyReport,
  TaskSource,
  TaskSourceGroup,
  DepartmentWeeklyReport,
  DepartmentWeeklyReportListResponse,
  DepartmentWeeklyReportDetail,
  DepartmentMonthlyReport,
  DepartmentMonthlyReportListResponse,
  DepartmentMonthlyReportDetail,
} from '@shared/api.interface';
import {
  DepartmentWeeklyReportQueryDto,
  DepartmentMonthlyReportQueryDto,
} from './dto/department-report-query.dto';
import { CreateDepartmentWeeklyReportDto } from './dto/create-department-weekly-report.dto';
import { CreateDepartmentMonthlyReportDto } from './dto/create-department-monthly-report.dto';

type DepartmentWeeklyReportRow = typeof departmentWeeklyReports.$inferSelect;
type DepartmentMonthlyReportRow = typeof departmentMonthlyReports.$inferSelect;
type DailyReportRow = typeof dailyReports.$inferSelect;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function addDays(dateStr: string, days: number): string {
  const base = new Date(`${dateStr}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function monthRange(reportMonth: string): { start: string; end: string } {
  const [yearPart, monthPart] = reportMonth.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${reportMonth}-01`,
    end: `${reportMonth}-${String(lastDay).padStart(2, '0')}`,
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

function mapWeeklyRow(row: DepartmentWeeklyReportRow): DepartmentWeeklyReport {
  return {
    id: row.id,
    department: row.department as DepartmentWeeklyReport['department'],
    weekStart: String(row.weekStart),
    weekEnd: String(row.weekEnd),
    summaryContent: row.summaryContent ?? undefined,
    issuesSummary: row.issuesSummary ?? undefined,
    reportCount: row.reportCount,
    totalWorkHours: Number(row.totalWorkHours),
    completionRate: Number(row.completionRate),
    issueCount: row.issueCount,
    generatorId: row.generatorId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    templateData: parseWeeklyTemplateData(row.templateData),
  };
}

function mapMonthlyRow(row: DepartmentMonthlyReportRow): DepartmentMonthlyReport {
  return {
    id: row.id,
    department: row.department as DepartmentMonthlyReport['department'],
    reportMonth: row.reportMonth,
    summaryContent: row.summaryContent ?? undefined,
    issuesSummary: row.issuesSummary ?? undefined,
    reportCount: row.reportCount,
    totalWorkHours: Number(row.totalWorkHours),
    completionRate: Number(row.completionRate),
    issueCount: row.issueCount,
    generatorId: row.generatorId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    templateData: parseMonthlyTemplateData(row.templateData),
  };
}

const isMeaningfulIssueText = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const normalized = trimmed.replace(/[。.,，、\s]/g, '');
  return normalized.length > 0 && normalized !== '无' && normalized !== '没有' && normalized !== '-';
};

function isIssueRow(row: DailyReportRow): boolean {
  return isMeaningfulIssueText(row.assistanceNeeded ?? '');
}

interface ReportAggregation {
  reportCount: number;
  issueCount: number;
}

function aggregateRows(rows: DailyReportRow[]): ReportAggregation {
  const issueCount = rows.filter(isIssueRow).length;
  return { reportCount: rows.length, issueCount };
}

// 日报的项目名/项目编号为数组，可能对应多个项目：按项目拆行展示
function expandByProject(rows: DailyReportRow[]): DailyReport[] {
  const expanded: DailyReport[] = [];
  for (const row of rows) {
    const names: string[] = row.projectName ?? [];
    const codes: string[] = row.projectCode ?? [];
    const projectCount = Math.max(names.length, codes.length);
    if (projectCount === 0) {
      expanded.push(mapDailyRow(row));
      continue;
    }
    for (let index = 0; index < projectCount; index += 1) {
      const name = names[index];
      const code = codes[index];
      expanded.push({
        ...mapDailyRow(row),
        projectName: name ? [name] : undefined,
        projectCode: code ? [code] : undefined,
      });
    }
  }
  return expanded;
}

function buildTaskSourceGroups(rows: DailyReportRow[]): TaskSourceGroup[] {
  return TASK_SOURCES.map((taskSource: TaskSource): TaskSourceGroup => {
    const groupRows = rows.filter(
      (row: DailyReportRow) => row.taskSource === taskSource,
    );

    return {
      taskSource,
      taskCount: groupRows.length,
      reports: expandByProject(groupRows),
    };
  }).filter((group: TaskSourceGroup) => group.taskCount > 0);
}

@Injectable()
export class DepartmentReportService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async findWeekly(
    query: DepartmentWeeklyReportQueryDto,
  ): Promise<DepartmentWeeklyReportListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (query.department) {
      conditions.push(eq(departmentWeeklyReports.department, query.department));
    }
    if (query.weekStart) {
      conditions.push(eq(departmentWeeklyReports.weekStart, query.weekStart));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const [itemsResult, countResult] = await Promise.all([
      this.db
        .select()
        .from(departmentWeeklyReports)
        .where(whereClause)
        .orderBy(desc(departmentWeeklyReports.weekStart))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(departmentWeeklyReports)
        .where(whereClause),
    ]);

    const items: DepartmentWeeklyReport[] = itemsResult.map(
      (row: DepartmentWeeklyReportRow) => mapWeeklyRow(row),
    );
    const total = countResult[0]?.count ?? 0;

    return { items, total, page, pageSize };
  }

  async findWeeklyOne(id: string): Promise<DepartmentWeeklyReportDetail> {
    if (!UUID_PATTERN.test(id)) {
      throw new NotFoundException('部门周报不存在');
    }

    const result = await this.db
      .select()
      .from(departmentWeeklyReports)
      .where(eq(departmentWeeklyReports.id, id))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('部门周报不存在');
    }

    const report = mapWeeklyRow(result[0]);
    const rows = await this.fetchDailyRows(
      report.department,
      report.weekStart,
      report.weekEnd,
    );

    return {
      ...report,
      taskSourceGroups: buildTaskSourceGroups(rows),
      issueReports: rows.filter(isIssueRow).map(mapDailyRow),
    };
  }

  async createWeekly(
    dto: CreateDepartmentWeeklyReportDto,
    generatorId: string,
  ): Promise<DepartmentWeeklyReport> {
    if (!DATE_PATTERN.test(dto.weekStart)) {
      throw new BadRequestException('周开始日期格式应为 YYYY-MM-DD');
    }

    const weekEnd = addDays(dto.weekStart, 6);
    const rows = await this.fetchDailyRows(
      dto.department,
      dto.weekStart,
      weekEnd,
    );
    const aggregation = aggregateRows(rows);

    const inserted = await this.db
      .insert(departmentWeeklyReports)
      .values({
        department: dto.department,
        weekStart: dto.weekStart,
        weekEnd,
        summaryContent: dto.summaryContent,
        issuesSummary: dto.issuesSummary ?? null,
        reportCount: aggregation.reportCount,
        totalWorkHours: '0',
        completionRate: '0',
        issueCount: aggregation.issueCount,
        templateData: parseWeeklyTemplateData(dto.templateData) ?? null,
        generatorId,
      })
      .onConflictDoUpdate({
        target: [
          departmentWeeklyReports.department,
          departmentWeeklyReports.weekStart,
        ],
        set: {
          weekEnd,
          summaryContent: dto.summaryContent,
          issuesSummary: dto.issuesSummary ?? null,
          reportCount: aggregation.reportCount,
          totalWorkHours: '0',
          completionRate: '0',
          issueCount: aggregation.issueCount,
          templateData: parseWeeklyTemplateData(dto.templateData) ?? null,
          generatorId,
          updatedAt: new Date(),
          updatedBy: generatorId,
        },
      })
      .returning();

    return mapWeeklyRow(inserted[0]);
  }

  async removeWeekly(id: string): Promise<{ success: true }> {
    if (!UUID_PATTERN.test(id)) {
      throw new NotFoundException('部门周报不存在');
    }

    const deleted = await this.db
      .delete(departmentWeeklyReports)
      .where(eq(departmentWeeklyReports.id, id))
      .returning({ id: departmentWeeklyReports.id });

    if (deleted.length === 0) {
      throw new NotFoundException('部门周报不存在');
    }

    return { success: true };
  }

  async updateWeeklyTemplate(
    id: string,
    templateData: unknown,
    userId: string,
  ): Promise<DepartmentWeeklyReport> {
    if (!UUID_PATTERN.test(id)) {
      throw new NotFoundException('部门周报不存在');
    }
    if (templateData === undefined || templateData === null) {
      throw new BadRequestException('模板数据不能为空');
    }
    const parsed = parseWeeklyTemplateData(templateData);
    if (!parsed) {
      throw new BadRequestException('模板数据格式不正确');
    }

    const updated = await this.db
      .update(departmentWeeklyReports)
      .set({
        templateData: parsed,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(departmentWeeklyReports.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('部门周报不存在');
    }

    return mapWeeklyRow(updated[0]);
  }

  async findMonthly(
    query: DepartmentMonthlyReportQueryDto,
  ): Promise<DepartmentMonthlyReportListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (query.department) {
      conditions.push(
        eq(departmentMonthlyReports.department, query.department),
      );
    }
    if (query.reportMonth) {
      conditions.push(
        eq(departmentMonthlyReports.reportMonth, query.reportMonth),
      );
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const [itemsResult, countResult] = await Promise.all([
      this.db
        .select()
        .from(departmentMonthlyReports)
        .where(whereClause)
        .orderBy(desc(departmentMonthlyReports.reportMonth))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(departmentMonthlyReports)
        .where(whereClause),
    ]);

    const items: DepartmentMonthlyReport[] = itemsResult.map(
      (row: DepartmentMonthlyReportRow) => mapMonthlyRow(row),
    );
    const total = countResult[0]?.count ?? 0;

    return { items, total, page, pageSize };
  }

  async findMonthlyOne(id: string): Promise<DepartmentMonthlyReportDetail> {
    if (!UUID_PATTERN.test(id)) {
      throw new NotFoundException('部门月报不存在');
    }

    const result = await this.db
      .select()
      .from(departmentMonthlyReports)
      .where(eq(departmentMonthlyReports.id, id))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('部门月报不存在');
    }

    const report = mapMonthlyRow(result[0]);
    const range = monthRange(report.reportMonth);
    const rows = await this.fetchDailyRows(
      report.department,
      range.start,
      range.end,
    );

    return {
      ...report,
      taskSourceGroups: buildTaskSourceGroups(rows),
      issueReports: rows.filter(isIssueRow).map(mapDailyRow),
    };
  }

  async createMonthly(
    dto: CreateDepartmentMonthlyReportDto,
    generatorId: string,
  ): Promise<DepartmentMonthlyReport> {
    if (!MONTH_PATTERN.test(dto.reportMonth)) {
      throw new BadRequestException('报告月份格式应为 YYYY-MM');
    }

    const range = monthRange(dto.reportMonth);
    const rows = await this.fetchDailyRows(
      dto.department,
      range.start,
      range.end,
    );
    const aggregation = aggregateRows(rows);

    const inserted = await this.db
      .insert(departmentMonthlyReports)
      .values({
        department: dto.department,
        reportMonth: dto.reportMonth,
        summaryContent: dto.summaryContent,
        issuesSummary: dto.issuesSummary ?? null,
        reportCount: aggregation.reportCount,
        totalWorkHours: '0',
        completionRate: '0',
        issueCount: aggregation.issueCount,
        templateData: parseMonthlyTemplateData(dto.templateData) ?? null,
        generatorId,
      })
      .onConflictDoUpdate({
        target: [
          departmentMonthlyReports.department,
          departmentMonthlyReports.reportMonth,
        ],
        set: {
          summaryContent: dto.summaryContent,
          issuesSummary: dto.issuesSummary ?? null,
          reportCount: aggregation.reportCount,
          totalWorkHours: '0',
          completionRate: '0',
          issueCount: aggregation.issueCount,
          templateData: parseMonthlyTemplateData(dto.templateData) ?? null,
          generatorId,
          updatedAt: new Date(),
          updatedBy: generatorId,
        },
      })
      .returning();

    return mapMonthlyRow(inserted[0]);
  }

  async removeMonthly(id: string): Promise<{ success: true }> {
    if (!UUID_PATTERN.test(id)) {
      throw new NotFoundException('部门月报不存在');
    }

    const deleted = await this.db
      .delete(departmentMonthlyReports)
      .where(eq(departmentMonthlyReports.id, id))
      .returning({ id: departmentMonthlyReports.id });

    if (deleted.length === 0) {
      throw new NotFoundException('部门月报不存在');
    }

    return { success: true };
  }

  async updateMonthlyTemplate(
    id: string,
    templateData: unknown,
    userId: string,
  ): Promise<DepartmentMonthlyReport> {
    if (!UUID_PATTERN.test(id)) {
      throw new NotFoundException('部门月报不存在');
    }
    if (templateData === undefined || templateData === null) {
      throw new BadRequestException('模板数据不能为空');
    }
    const parsed = parseMonthlyTemplateData(templateData);
    if (!parsed) {
      throw new BadRequestException('模板数据格式不正确');
    }

    const updated = await this.db
      .update(departmentMonthlyReports)
      .set({
        templateData: parsed,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(departmentMonthlyReports.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('部门月报不存在');
    }

    return mapMonthlyRow(updated[0]);
  }

  private async fetchDailyRows(
    department: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyReportRow[]> {
    return this.db
      .select()
      .from(dailyReports)
      .where(
        and(
          eq(dailyReports.department, department),
          gte(dailyReports.reportDate, startDate),
          lte(dailyReports.reportDate, endDate),
        ),
      )
      .orderBy(desc(dailyReports.reportDate));
  }
}
