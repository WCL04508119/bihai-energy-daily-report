import { TASK_SOURCES } from '@shared/api.interface';
import type { DailyReport, TaskSource, TaskSourceGroup } from '@shared/api.interface';

const isMeaningfulIssueText = (value?: string): boolean => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return false;
  const normalized = trimmed.replace(/[。.,，、\s]/g, '');
  return normalized.length > 0 && normalized !== '无' && normalized !== '没有' && normalized !== '-';
};

export const isIssueReport = (report: DailyReport): boolean =>
  isMeaningfulIssueText(report.assistanceNeeded);

export const getIssueReports = (reports: DailyReport[]): DailyReport[] =>
  reports.filter(isIssueReport);

// 项目多选：返回该日报拆分到的「(projectName, projectCode)」组合。
// 无项目信息时返回单个空组合（以 taskName 兜底），保证每条日报至少参与一次分组。
export const expandProjects = (
  report: DailyReport,
): { projectName: string | undefined; projectCode: string | undefined }[] => {
  const names: string[] = (report.projectName ?? []).filter(
    (name: string) => name.trim().length > 0,
  );
  const codes: string[] = (report.projectCode ?? []).filter(
    (code: string) => code.trim().length > 0,
  );
  if (names.length === 0 && codes.length === 0) {
    return [{ projectName: undefined, projectCode: undefined }];
  }
  const combos: { projectName: string | undefined; projectCode: string | undefined }[] = [];
  const maxLen = Math.max(names.length, codes.length);
  for (let i = 0; i < maxLen; i += 1) {
    combos.push({
      projectName: names[i],
      projectCode: codes[i],
    });
  }
  return combos;
};

export const groupByTaskSource = (reports: DailyReport[]): TaskSourceGroup[] => {
  const sourceOrder: readonly string[] = TASK_SOURCES;
  const groups = new Map<string, DailyReport[]>();
  for (const report of reports) {
    const list = groups.get(report.taskSource);
    if (list) {
      list.push(report);
    } else {
      groups.set(report.taskSource, [report]);
    }
  }
  const orderedSources: string[] = [
    ...sourceOrder.filter((source: string) => groups.has(source)),
    ...[...groups.keys()].filter(
      (source: string) => !sourceOrder.includes(source),
    ),
  ];
  return orderedSources.map((source: string) => {
    const groupReports = groups.get(source) ?? [];
    return {
      taskSource: source as TaskSource,
      taskCount: groupReports.length,
      reports: groupReports,
    };
  });
};