import {
  TASK_SOURCES,
  isTaskSource,
  type CompletionStatus,
  type DailyReport,
  type MonthlyTemplateData,
  type ReportGoalRow,
  type ReportIssueRow,
  type ReportMilestoneRow,
  type ReportNextPlanRow,
  type TaskSource,
  type WeeklyTemplateData,
} from '@shared/api.interface';
import {
  expandProjects,
  groupByTaskSource,
  isIssueReport,
} from '@/utils/report-group';

export interface BuildWeeklyOptions {
  previousPlanRows?: ReportNextPlanRow[];
  summaryPoints?: string[];
  nextPlanRows?: ReportNextPlanRow[];
}

export interface BuildMonthlyOptions {
  previousPlanRows?: ReportNextPlanRow[];
  summaryPoints?: string[];
  milestoneRows?: ReportMilestoneRow[];
  nextPlanRows?: ReportNextPlanRow[];
}

export interface TemplateNarrative {
  summaryPoints: string[];
  nextPlanRows: ReportNextPlanRow[];
}

const JSON_BLOCK_PATTERN = /```json\s*([\s\S]*?)```/iu;
const MAX_ACTUAL_OUTPUT_SEGMENTS = 4;
const MAX_SUMMARY_POINTS = 3;
const MAX_NEXT_PLAN_ROWS = 5;
const EMPTY_TEXTS: readonly string[] = ['无', '没有', '-'];

const round1 = (value: number): number => Math.round(value * 10) / 10;

const normalizeText = (value?: string): string => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  const compactText = trimmed.replace(/[。.,，、\s]/g, '');
  if (!compactText) return '';
  return EMPTY_TEXTS.includes(compactText) ? '' : trimmed;
};

const collectTexts = (
  reports: DailyReport[],
  pick: (report: DailyReport) => string | undefined,
): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const report of reports) {
    const text = normalizeText(pick(report));
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
};

const firstText = (
  reports: DailyReport[],
  pick: (report: DailyReport) => string | undefined,
): string | undefined => {
  for (const report of reports) {
    const text = normalizeText(pick(report));
    if (text) return text;
  }
  return undefined;
};

const sortByDate = (reports: DailyReport[]): DailyReport[] =>
  [...reports].sort((a: DailyReport, b: DailyReport) =>
    a.reportDate.localeCompare(b.reportDate),
  );

const joinTexts = (texts: string[], limit: number): string =>
  texts.slice(0, limit).join('；');

const sourceRank = (source?: TaskSource): number => {
  const index = source
    ? (TASK_SOURCES as readonly string[]).indexOf(source)
    : -1;
  return index < 0 ? TASK_SOURCES.length : index;
};

const groupByKey = (
  reports: DailyReport[],
  keyOf: (report: DailyReport) => string,
): DailyReport[][] => {
  const groups = new Map<string, DailyReport[]>();
  for (const report of reports) {
    const key = keyOf(report);
    const existing = groups.get(key);
    if (existing) {
      existing.push(report);
    } else {
      groups.set(key, [report]);
    }
  }
  return [...groups.values()];
};

// 项目多选展开：为每个项目组合生成一份带单值 projectName/projectCode 的副本，便于复用原分组逻辑
const expandReportCopies = (report: DailyReport): DailyReport[] => {
  const combos = expandProjects(report);
  return combos.map((combo) => ({
    ...report,
    projectName: combo.projectName ? [combo.projectName] : undefined,
    projectCode: combo.projectCode ? [combo.projectCode] : undefined,
  }));
};

const firstProjectText = (report: DailyReport, key: 'projectName' | 'projectCode'): string =>
  ((report[key] ?? [])[0] ?? '').trim();

const goalGroupKey = (report: DailyReport): string =>
  `${firstProjectText(report, 'projectCode')}||${
    firstProjectText(report, 'projectName') || report.taskName.trim()
  }`;

const issueGroupKey = (report: DailyReport): string =>
  `${firstProjectText(report, 'projectCode')}||${report.taskName.trim()}`;

const matchPreviousGoal = (
  previousPlanRows: ReportNextPlanRow[],
  projectCode: string | undefined,
  names: string[],
): string | undefined => {
  for (const row of previousPlanRows) {
    const rowCode = (row.projectCode ?? '').trim();
    const sameCode = Boolean(projectCode && rowCode === projectCode);
    const keyTask = row.keyTask ?? '';
    const includesName = names.some(
      (name: string) => Boolean(name) && keyTask.includes(name),
    );
    if (sameCode || includesName) {
      const matched = normalizeText(row.keyTask);
      if (matched) return matched;
    }
  }
  return undefined;
};

const buildGoalRows = (
  reports: DailyReport[],
  previousPlanRows: ReportNextPlanRow[],
): ReportGoalRow[] => {
  const expanded: DailyReport[] = sortByDate(reports).flatMap(expandReportCopies);
  const groups = groupByKey(expanded, goalGroupKey);
  const rows: ReportGoalRow[] = groups.map((group: DailyReport[]) => {
    const first: DailyReport = group[0];
    const projectCode = firstProjectText(first, 'projectCode') || undefined;
    const projectName =
      firstProjectText(first, 'projectName') || first.taskName;
    const previousGoal = matchPreviousGoal(previousPlanRows, projectCode, [
      projectName,
      first.taskName,
      ...collectTexts(group, (report: DailyReport) => report.taskName),
    ]);
    const goal: string = previousGoal ?? '';
    const outputs: string[] = collectTexts(
      group,
      (report: DailyReport) => report.dayCompletion,
    );
    const uniqueOutputs: string[] = [...new Set(outputs)];
    return {
      taskSource: first.taskSource,
      projectCode,
      projectName,
      goal,
      actualOutput: joinTexts(uniqueOutputs, MAX_ACTUAL_OUTPUT_SEGMENTS),
    };
  });

  return rows.sort((a: ReportGoalRow, b: ReportGoalRow) => {
    const rankDiff = sourceRank(a.taskSource) - sourceRank(b.taskSource);
    if (rankDiff !== 0) return rankDiff;
    return (a.projectCode ?? '').localeCompare(b.projectCode ?? '');
  });
};

// 删完成情况判定后，卡点类型统一判定为「已发生问题」（assistanceNeeded 即实际已发生需协助事项）
const buildIssueRows = (reports: DailyReport[]): ReportIssueRow[] => {
  const issueReports = sortByDate(reports)
    .filter(isIssueReport)
    .flatMap(expandReportCopies);
  const groups = groupByKey(issueReports, issueGroupKey);
  return groups.map((group: DailyReport[]) => {
    const first: DailyReport = group[0];
    const riskDesc =
      firstText(group, (report: DailyReport) => report.assistanceNeeded) ?? '';
    const causeTexts: string[] = collectTexts(
      group,
      (report: DailyReport) => report.assistanceNeeded,
    );
    const ownerIds: string[] = [
      ...new Set(
        group
          .map((report: DailyReport) => report.reporterId)
          .filter((id: string) => id.trim().length > 0),
      ),
    ];
    return {
      taskSource: first.taskSource,
      projectCode: firstProjectText(first, 'projectCode') || undefined,
      projectName: firstProjectText(first, 'projectName') || undefined,
      riskDesc,
      issueType: '已发生问题',
      causeAndAction: [...new Set(causeTexts)].join('；'),
      ownerIds,
      status: '处理中',
      supportNeeded: firstText(
        group,
        (report: DailyReport) => report.assistanceNeeded,
      ),
    };
  });
};

export function buildWeeklyTemplateData(
  reports: DailyReport[],
  options?: BuildWeeklyOptions,
): WeeklyTemplateData {
  return {
    goalRows: buildGoalRows(reports, options?.previousPlanRows ?? []),
    issueRows: buildIssueRows(reports),
    summaryPoints: options?.summaryPoints ?? [],
    nextPlanRows: options?.nextPlanRows ?? [],
  };
}

export function buildMonthlyTemplateData(
  reports: DailyReport[],
  options?: BuildMonthlyOptions,
): MonthlyTemplateData {
  return {
    goalRows: buildGoalRows(reports, options?.previousPlanRows ?? []),
    milestoneRows: options?.milestoneRows ?? [],
    issueRows: buildIssueRows(reports),
    nextPlanRows: options?.nextPlanRows ?? [],
  };
}

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

const parseIsoDate = (value: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const shiftIsoDate = (value: string, days: number): string => {
  const parsed = parseIsoDate(value);
  if (!parsed) return '';
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return toIsoDate(parsed);
};

const getPeriodBounds = (reports: DailyReport[]): {
  startDate: string;
  endDate: string;
} => {
  const dates: string[] = reports
    .map((report: DailyReport) => (report.reportDate ?? '').slice(0, 10))
    .filter((date: string) => parseIsoDate(date) !== null);
  if (dates.length === 0) return { startDate: '', endDate: '' };
  const sorted: string[] = [...dates].sort((a: string, b: string) =>
    a.localeCompare(b),
  );
  return { startDate: sorted[0], endDate: sorted[sorted.length - 1] };
};

const buildMaterial = (reports: DailyReport[]): string => {
  const groups = groupByTaskSource(reports);
  if (groups.length === 0) return '（本期无日报素材）';
  return groups
    .map((group) => {
      const lines: string = group.reports
        .map((report: DailyReport) => {
          const projects: string =
            (report.projectCode ?? []).length > 0
              ? (report.projectCode ?? []).join('、')
              : '未填写';
          return `- 任务：${report.taskName}｜项目编号：${projects}｜完成说明：${
            report.dayCompletion || '未填写'
          }｜所需支持：${report.assistanceNeeded || '无'}`;
        })
        .join('\n');
      return `【${group.taskSource}】\n${lines}`;
    })
    .join('\n\n');
};

export function buildTemplatePrompt(
  period: 'week' | 'month',
  reports: DailyReport[],
): string {
  const isWeek: boolean = period === 'week';
  const periodText: string = isWeek ? '本周' : '本月';
  const nextText: string = isWeek ? '下周' : '下月';
  const { startDate, endDate } = getPeriodBounds(reports);
  const dueStart: string = shiftIsoDate(endDate, 1);
  const dueEnd: string = shiftIsoDate(endDate, isWeek ? 7 : 30);

  return `你是一名企业工作汇报助手，服务对象是北京碧海能源装备有限公司的员工。请依据 ${startDate} 至 ${endDate} 的 ${reports.length} 条日报素材，整理${periodText}的经验总结与${nextText}工作计划。

只输出一个 \`\`\`json 代码块，代码块外不要输出任何说明文字，不要输出多余代码块。JSON 结构必须为：
{"summaryPoints": ["要点1"], "nextPlanRows": [{"taskSource": "", "projectCode": "", "keyTask": "", "deliverable": "", "dueDate": "", "resourcesNeeded": ""}]}

要求：
1. summaryPoints 为${periodText}的经验、教训或改进建议，1-3 条，每条 40 字以内，内容必须来自日报素材。
2. nextPlanRows 为${nextText}计划，2-5 条，必须基于日报中的未完成事项与在办事项推进，禁止编造日报中没有的项目编号与任务。
3. taskSource 只能取「部门日常、项目任务、临时需求、会议安排、跨部门协作」之一。
4. keyTask 为计划事项名称，deliverable 为交付物，dueDate 使用 YYYY-MM-DD 格式且限定在 ${dueStart} 至 ${dueEnd} 之间。
5. projectCode 沿用日报中的项目编号，日报未填写时留空字符串；resourcesNeeded 可为空字符串。

日报素材（按任务来源分组，含任务名、项目编号、完成说明、所需支持）：
${buildMaterial(reports)}`;
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const asTrimmedText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toNextPlanRow = (raw: unknown): ReportNextPlanRow | null => {
  const record = asRecord(raw);
  if (!record) return null;
  const keyTask = asTrimmedText(record.keyTask);
  if (!keyTask) return null;
  const row: ReportNextPlanRow = { keyTask };
  const taskSource = asTrimmedText(record.taskSource);
  if (taskSource && isTaskSource(taskSource)) row.taskSource = taskSource;
  row.projectCode = asTrimmedText(record.projectCode);
  row.deliverable = asTrimmedText(record.deliverable);
  row.dueDate = asTrimmedText(record.dueDate);
  row.resourcesNeeded = asTrimmedText(record.resourcesNeeded) ?? '';
  return row;
};

export function parseTemplateNarrative(text: string): TemplateNarrative | null {
  const match = text.match(JSON_BLOCK_PATTERN);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    return null;
  }
  const record = asRecord(parsed);
  if (!record) return null;

  const summarySource: unknown[] = Array.isArray(record.summaryPoints)
    ? record.summaryPoints
    : [];
  const summaryPoints: string[] = summarySource
    .map((item: unknown) => asTrimmedText(item))
    .filter((item: string | undefined): item is string => item !== undefined)
    .slice(0, MAX_SUMMARY_POINTS);

  const planSource: unknown[] = Array.isArray(record.nextPlanRows)
    ? record.nextPlanRows
    : [];
  const nextPlanRows: ReportNextPlanRow[] = planSource
    .map((item: unknown) => toNextPlanRow(item))
    .filter(
      (item: ReportNextPlanRow | null): item is ReportNextPlanRow =>
        item !== null,
    )
    .slice(0, MAX_NEXT_PLAN_ROWS);

  return { summaryPoints, nextPlanRows };
}
