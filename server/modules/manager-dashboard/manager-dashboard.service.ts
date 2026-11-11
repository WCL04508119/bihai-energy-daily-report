import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import {
  AuthNPaasService,
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';

import { dailyReports } from '../../database/schema';
import { DataScopeService } from '../data-scope/data-scope.service';
import { DEPARTMENTS } from '@shared/api.interface';
import type {
  ManagerAnalysisCompletionItem,
  ManagerAnalysisContext,
  ManagerAnalysisIssueItem,
  ManagerDashboardResponse,
  ManagerDepartmentRow,
  ManagerMetric,
  ManagerPeriod,
  ManagerPersonRow,
} from '@shared/api.interface';

const DAY_MS = 24 * 60 * 60 * 1000;
const ISSUE_EMPTY_VALUES = new Set<string>(['', '无', '没有', '-', '—', '无。', '暂无']);
const MAX_METRICS = 5;
const MAX_ANALYSIS_ITEMS = 40;
const MAX_ANALYSIS_TEXT = 240;

interface RangeInfo {
  start: string;
  end: string;
  label: string;
}

interface MetricBucket {
  count: number;
  people: Set<string>;
  departments: Set<string>;
}

interface ReportRow {
  reporterId: string;
  department: string;
  taskSources: string[] | null;
  taskSource: string;
  projectName: string[] | null;
  taskName: string;
  assistanceNeeded: string | null;
  dayCompletion: string | null;
  reportDate: string;
}

interface ManagerQueryParams {
  period: ManagerPeriod;
  anchor?: string;
  department?: string;
  roles: string[] | undefined;
  userId: string;
}

const toIsoDay = (date: Date): string => date.toISOString().slice(0, 10);

const shiftDay = (day: string, offset: number): string =>
  toIsoDay(new Date(new Date(`${day}T00:00:00Z`).getTime() + offset * DAY_MS));

const todayInShanghai = (): string =>
  toIsoDay(new Date(Date.now() + 8 * 60 * 60 * 1000));

const resolveRange = (period: ManagerPeriod, anchor?: string): RangeInfo => {
  const day: string = anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor)
    ? anchor
    : todayInShanghai();
  if (period === 'day') {
    return { start: day, end: day, label: day };
  }
  if (period === 'week') {
    const weekday: number = new Date(`${day}T00:00:00Z`).getUTCDay();
    const offset: number = (weekday + 6) % 7;
    const start: string = shiftDay(day, -offset);
    const end: string = shiftDay(start, 6);
    return { start, end, label: `${start} ~ ${end}` };
  }
  const monthStart: string = `${day.slice(0, 7)}-01`;
  const nextMonthStart: string = toIsoDay(
    new Date(new Date(`${monthStart}T00:00:00Z`).getTime() + 32 * DAY_MS),
  );
  const end: string = shiftDay(nextMonthStart.slice(0, 7) + '-01', -1);
  return { start: monthStart, end, label: day.slice(0, 7) };
};

const isIssue = (value: string | null): boolean =>
  Boolean(value && !ISSUE_EMPTY_VALUES.has(value.trim()));

const compact = (value: string): string => value.replace(/\s+/g, '');

const truncateText = (value: string): string =>
  value.length > MAX_ANALYSIS_TEXT
    ? `${value.slice(0, MAX_ANALYSIS_TEXT)}…`
    : value;

const normalizeDepartment = (value: string): string => {
  const trimmed: string = (value ?? '').trim();
  const matched: string | undefined = DEPARTMENTS.find(
    (item: string) => compact(item) === compact(trimmed),
  );
  return matched ?? trimmed;
};

const pushMetric = (
  bucket: Map<string, MetricBucket>,
  name: string,
  userId: string,
  department: string,
): void => {
  const key: string = name.trim();
  if (!key) return;
  const current: MetricBucket =
    bucket.get(key) ?? { count: 0, people: new Set<string>(), departments: new Set<string>() };
  current.count += 1;
  current.people.add(userId);
  current.departments.add(department);
  bucket.set(key, current);
};

const toMetrics = (bucket: Map<string, MetricBucket>): ManagerMetric[] =>
  Array.from(bucket.entries())
    .map(([name, value]: [string, MetricBucket]) => ({
      name,
      count: value.count,
      peopleCount: value.people.size,
    }))
    .sort((a: ManagerMetric, b: ManagerMetric) => b.count - a.count)
    .slice(0, MAX_METRICS);

@Injectable()
export class ManagerDashboardService {
  private readonly logger = new Logger(ManagerDashboardService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly dataScope: DataScopeService,
    private readonly authn: AuthNPaasService,
  ) {}

  async summary(params: ManagerQueryParams): Promise<ManagerDashboardResponse> {
    const { range, rows } = await this.loadRows(params);

    const names: Map<string, string> = await this.resolveNames(
      Array.from(new Set(rows.map((row: ReportRow) => row.reporterId))),
    );

    const projectNames: Set<string> = new Set<string>();
    const peopleByDepartment: Map<string, Set<string>> = new Map<string, Set<string>>();
    const deptTaskSources: Map<string, Map<string, MetricBucket>> = new Map();
    const deptProjects: Map<string, Map<string, MetricBucket>> = new Map();
    const personStats: Map<
      string,
      { department: string; count: number; days: Set<string>; projects: Set<string>; issues: number }
    > = new Map();
    const personTaskSources: Map<string, Map<string, MetricBucket>> = new Map();
    const taskSourceBucket: Map<string, MetricBucket> = new Map();
    const projectBucket: Map<string, MetricBucket> = new Map();
    let issueCount: number = 0;

    for (const row of rows) {
      const sources: string[] = (
        row.taskSources && row.taskSources.length > 0
          ? row.taskSources
          : [row.taskSource]
      )
        .map((name: string) => name.trim())
        .filter((name: string) => name.length > 0);
      const projects: string[] = (row.projectName ?? [])
        .map((name: string) => name.trim())
        .filter((name: string) => name.length > 0);
      const issue: boolean = isIssue(row.assistanceNeeded);
      if (issue) issueCount += 1;
      projects.forEach((name: string) => projectNames.add(name));

      const deptPeople: Set<string> =
        peopleByDepartment.get(row.department) ?? new Set<string>();
      deptPeople.add(row.reporterId);
      peopleByDepartment.set(row.department, deptPeople);

      const deptSources: Map<string, MetricBucket> =
        deptTaskSources.get(row.department) ?? new Map<string, MetricBucket>();
      sources.forEach((name: string) =>
        pushMetric(deptSources, name, row.reporterId, row.department),
      );
      deptTaskSources.set(row.department, deptSources);

      const deptProjectMap: Map<string, MetricBucket> =
        deptProjects.get(row.department) ?? new Map<string, MetricBucket>();
      projects.forEach((name: string) =>
        pushMetric(deptProjectMap, name, row.reporterId, row.department),
      );
      deptProjects.set(row.department, deptProjectMap);

      const person =
        personStats.get(row.reporterId) ?? {
          department: row.department,
          count: 0,
          days: new Set<string>(),
          projects: new Set<string>(),
          issues: 0,
        };
      person.count += 1;
      person.days.add(row.reportDate);
      person.department = row.department;
      projects.forEach((name: string) => person.projects.add(name));
      if (issue) person.issues += 1;
      personStats.set(row.reporterId, person);

      const personSourceMap: Map<string, MetricBucket> =
        personTaskSources.get(row.reporterId) ?? new Map<string, MetricBucket>();
      sources.forEach((name: string) =>
        pushMetric(personSourceMap, name, row.reporterId, row.department),
      );
      personTaskSources.set(row.reporterId, personSourceMap);

      sources.forEach((name: string) =>
        pushMetric(taskSourceBucket, name, row.reporterId, row.department),
      );
      projects.forEach((name: string) =>
        pushMetric(projectBucket, name, row.reporterId, row.department),
      );
    }

    const byDepartment: ManagerDepartmentRow[] = Array.from(
      peopleByDepartment.entries(),
    )
      .map(([department, people]: [string, Set<string>]) => {
        const deptRows: ReportRow[] = rows.filter(
          (row: ReportRow) => row.department === department,
        );
        const projectSet: Set<string> = new Set<string>();
        deptRows.forEach((row: ReportRow) =>
          (row.projectName ?? []).forEach((name: string) => {
            if (name.trim()) projectSet.add(name.trim());
          }),
        );
        return {
          department,
          reportCount: deptRows.length,
          peopleCount: people.size,
          projectCount: projectSet.size,
          issueCount: deptRows.filter((row: ReportRow) =>
            isIssue(row.assistanceNeeded),
          ).length,
          taskSources: toMetrics(
            deptTaskSources.get(department) ?? new Map<string, MetricBucket>(),
          ),
          topProjects: toMetrics(
            deptProjects.get(department) ?? new Map<string, MetricBucket>(),
          ),
        };
      })
      .sort(
        (a: ManagerDepartmentRow, b: ManagerDepartmentRow) =>
          b.reportCount - a.reportCount,
      );

    const byPerson: ManagerPersonRow[] = Array.from(personStats.entries())
      .map(([userId, stat]: [
        string,
        { department: string; count: number; days: Set<string>; projects: Set<string>; issues: number },
      ]) => ({
        userId,
        name: names.get(userId) ?? '未命名成员',
        department: stat.department,
        reportCount: stat.count,
        activeDays: stat.days.size,
        projectCount: stat.projects.size,
        issueCount: stat.issues,
        taskSources: toMetrics(
          personTaskSources.get(userId) ?? new Map<string, MetricBucket>(),
        ),
      }))
      .sort(
        (a: ManagerPersonRow, b: ManagerPersonRow) =>
          b.reportCount - a.reportCount,
      );

    return {
      period: params.period,
      rangeStart: range.start,
      rangeEnd: range.end,
      rangeLabel: range.label,
      totals: {
        reportCount: rows.length,
        peopleCount: personStats.size,
        departmentCount: peopleByDepartment.size,
        projectCount: projectNames.size,
        issueCount,
      },
      byDepartment,
      byPerson,
      byTaskSource: toMetrics(taskSourceBucket),
      byProject: toMetrics(projectBucket),
    };
  }

  async analysisContext(
    params: ManagerQueryParams,
  ): Promise<ManagerAnalysisContext> {
    const { range, rows, scopeLabel } = await this.loadRows(params);
    const names: Map<string, string> = await this.resolveNames(
      Array.from(new Set(rows.map((row: ReportRow) => row.reporterId))),
    );

    const projectNames: Set<string> = new Set<string>();
    const departmentPeople: Map<string, Set<string>> = new Map<string, Set<string>>();
    const departmentProjects: Map<string, Set<string>> = new Map<string, Set<string>>();
    const departmentReports: Map<string, number> = new Map<string, number>();
    const departmentIssues: Map<string, number> = new Map<string, number>();
    const taskSourceBucket: Map<string, MetricBucket> = new Map<string, MetricBucket>();
    const projectBucket: Map<string, MetricBucket> = new Map<string, MetricBucket>();
    let issueCount: number = 0;

    rows.forEach((row: ReportRow) => {
      const sources: string[] = (
        row.taskSources && row.taskSources.length > 0
          ? row.taskSources
          : [row.taskSource]
      )
        .map((name: string) => name.trim())
        .filter((name: string) => name.length > 0);
      const projects: string[] = (row.projectName ?? [])
        .map((name: string) => name.trim())
        .filter((name: string) => name.length > 0);
      const issue: boolean = isIssue(row.assistanceNeeded);
      if (issue) issueCount += 1;

      sources.forEach((name: string) =>
        pushMetric(taskSourceBucket, name, row.reporterId, row.department),
      );
      projects.forEach((name: string) => {
        projectNames.add(name);
        pushMetric(projectBucket, name, row.reporterId, row.department);
      });

      const people: Set<string> =
        departmentPeople.get(row.department) ?? new Set<string>();
      people.add(row.reporterId);
      departmentPeople.set(row.department, people);

      const deptProjectSet: Set<string> =
        departmentProjects.get(row.department) ?? new Set<string>();
      projects.forEach((name: string) => deptProjectSet.add(name));
      departmentProjects.set(row.department, deptProjectSet);

      departmentReports.set(
        row.department,
        (departmentReports.get(row.department) ?? 0) + 1,
      );
      if (issue) {
        departmentIssues.set(
          row.department,
          (departmentIssues.get(row.department) ?? 0) + 1,
        );
      }
    });

    const byDepartment: ManagerDepartmentRow[] = Array.from(
      departmentPeople.entries(),
    )
      .map(([department, people]: [string, Set<string>]) => ({
        department,
        reportCount: departmentReports.get(department) ?? 0,
        peopleCount: people.size,
        projectCount: (departmentProjects.get(department) ?? new Set<string>())
          .size,
        issueCount: departmentIssues.get(department) ?? 0,
        taskSources: [],
        topProjects: [],
      }))
      .sort(
        (a: ManagerDepartmentRow, b: ManagerDepartmentRow) =>
          b.reportCount - a.reportCount,
      );

    const issueRows: ReportRow[] = rows
      .filter((row: ReportRow) => isIssue(row.assistanceNeeded))
      .sort((a: ReportRow, b: ReportRow) =>
        a.reportDate < b.reportDate ? 1 : -1,
      );
    const completionRows: ReportRow[] = rows
      .filter((row: ReportRow) =>
        Boolean(row.dayCompletion && row.dayCompletion.trim()),
      )
      .sort((a: ReportRow, b: ReportRow) =>
        a.reportDate < b.reportDate ? 1 : -1,
      );

    return {
      period: params.period,
      rangeLabel: range.label,
      scopeLabel,
      totals: {
        reportCount: rows.length,
        peopleCount: new Set(
          rows.map((row: ReportRow) => row.reporterId),
        ).size,
        departmentCount: departmentPeople.size,
        projectCount: projectNames.size,
        issueCount,
      },
      byDepartment,
      byTaskSource: toMetrics(taskSourceBucket),
      byProject: toMetrics(projectBucket),
      issueItems: this.buildIssueItems(issueRows, names),
      completionItems: this.buildCompletionItems(completionRows, names),
      truncated:
        issueRows.length > MAX_ANALYSIS_ITEMS ||
        completionRows.length > MAX_ANALYSIS_ITEMS,
    };
  }

  private buildIssueItems(
    rows: ReportRow[],
    names: Map<string, string>,
  ): ManagerAnalysisIssueItem[] {
    return rows.slice(0, MAX_ANALYSIS_ITEMS).map((row: ReportRow) => ({
      reportDate: row.reportDate,
      department: row.department,
      personName: names.get(row.reporterId) ?? '未命名成员',
      taskSources: row.taskSources?.length
        ? row.taskSources
        : [row.taskSource],
      projectNames: row.projectName ?? [],
      taskName: row.taskName,
      assistanceNeeded: truncateText((row.assistanceNeeded ?? '').trim()),
    }));
  }

  private buildCompletionItems(
    rows: ReportRow[],
    names: Map<string, string>,
  ): ManagerAnalysisCompletionItem[] {
    return rows.slice(0, MAX_ANALYSIS_ITEMS).map((row: ReportRow) => ({
      reportDate: row.reportDate,
      department: row.department,
      personName: names.get(row.reporterId) ?? '未命名成员',
      projectNames: row.projectName ?? [],
      taskName: row.taskName,
      completion: truncateText((row.dayCompletion ?? '').trim()),
    }));
  }

  private async loadRows(params: ManagerQueryParams): Promise<{
    range: RangeInfo;
    rows: ReportRow[];
    scopeLabel: string;
  }> {
    const scope = await this.dataScope.resolve(params.roles, params.userId);
    if (scope.kind === 'self') {
      throw new ForbiddenException('无管理者看板访问权限');
    }

    const range: RangeInfo = resolveRange(params.period, params.anchor);
    const conditions = [
      gte(dailyReports.reportDate, range.start),
      lte(dailyReports.reportDate, range.end),
    ];

    if (params.department && params.department !== 'all') {
      if (!this.dataScope.canAccessDepartment(scope, params.department)) {
        throw new ForbiddenException('无权查看该部门数据');
      }
      conditions.push(eq(dailyReports.department, params.department));
    } else if (scope.kind === 'department') {
      conditions.push(inArray(dailyReports.department, scope.departments));
    }

    const rawRows = await this.db
      .select({
        reporterId: dailyReports.reporterId,
        department: dailyReports.department,
        taskSources: dailyReports.taskSources,
        taskSource: dailyReports.taskSource,
        projectName: dailyReports.projectName,
        taskName: dailyReports.taskName,
        assistanceNeeded: dailyReports.assistanceNeeded,
        dayCompletion: dailyReports.dayCompletion,
        reportDate: dailyReports.reportDate,
      })
      .from(dailyReports)
      .where(and(...conditions));

    const rows: ReportRow[] = rawRows.map((row) => ({
      reporterId: row.reporterId,
      department: normalizeDepartment(row.department),
      taskSources: row.taskSources,
      taskSource: row.taskSource,
      projectName: row.projectName,
      taskName: row.taskName,
      assistanceNeeded: row.assistanceNeeded,
      dayCompletion: row.dayCompletion,
      reportDate: String(row.reportDate).slice(0, 10),
    }));

    const scopeLabel: string =
      scope.kind === 'department' && scope.departments.length > 0
        ? scope.departments.join('、')
        : '全公司';

    return { range, rows, scopeLabel };
  }

  private async resolveNames(userIds: string[]): Promise<Map<string, string>> {
    const names: Map<string, string> = new Map<string, string>();
    if (userIds.length === 0) return names;
    try {
      const users = await this.authn.listUsersByIds(userIds);
      users.forEach((user) => {
        if (!user) return;
        const id: string =
          user.miaodaUserID && userIds.includes(user.miaodaUserID)
            ? user.miaodaUserID
            : '';
        if (!id) return;
        names.set(id, user.name?.zh_cn ?? user.name?.en_us ?? '未命名成员');
      });
    } catch (error) {
      this.logger.warn(
        `管理者看板姓名解析失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return names;
  }
}
