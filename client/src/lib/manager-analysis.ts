import { capabilityClient } from '@lark-apaas/client-toolkit';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  ManagerAnalysisCompletionItem,
  ManagerAnalysisContext,
  ManagerAnalysisDimension,
  ManagerAnalysisIssueItem,
  ManagerDepartmentRow,
  ManagerMetric,
} from '@shared/api.interface';
import { MANAGER_ANALYSIS_DIMENSION_LABELS } from '@shared/api.interface';

export const MANAGER_ANALYSIS_PLUGIN_ID = 'bihai_smart_employee_daily_report_1';

const DEFAULT_REQUIREMENT =
  '重点分析卡点与完成情况，指出需要跨部门协调的事项';

const DIMENSION_FOCUS: Record<ManagerAnalysisDimension, string> = {
  all: '同时按「项目」与「任务来源」两个维度归并',
  project: '按「项目」维度归并',
  task: '按「任务来源」维度归并',
};

type StreamChunk = Record<string, unknown>;

const isAsyncIterable = (
  value: unknown,
): value is AsyncIterable<StreamChunk> => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { [Symbol.asyncIterator]?: unknown };
  return typeof candidate[Symbol.asyncIterator] === 'function';
};

const normalizeStream = (
  resultOrStream: unknown,
): AsyncIterable<StreamChunk> => {
  if (isAsyncIterable(resultOrStream)) return resultOrStream;
  if (
    typeof resultOrStream === 'object' &&
    resultOrStream !== null &&
    'output' in resultOrStream
  ) {
    const output = (resultOrStream as { output?: unknown }).output;
    if (isAsyncIterable(output)) return output;
  }
  throw new Error('AI 分析返回格式异常');
};

const formatMetrics = (items: ManagerMetric[]): string =>
  items.length === 0
    ? '无'
    : items
        .map(
          (item: ManagerMetric) =>
            `${item.name}（${item.count} 条 / ${item.peopleCount} 人）`,
        )
        .join('；');

const formatDepartments = (items: ManagerDepartmentRow[]): string =>
  items.length === 0
    ? '无'
    : items
        .map(
          (row: ManagerDepartmentRow) =>
            `- ${row.department}：日报 ${row.reportCount} 条，参与 ${row.peopleCount} 人，项目 ${row.projectCount} 个，卡点 ${row.issueCount} 条`,
        )
        .join('\n');

const formatIssueItems = (items: ManagerAnalysisIssueItem[]): string => {
  if (items.length === 0) return '无';
  return items
    .map((item: ManagerAnalysisIssueItem) => {
      const target: string =
        [...item.projectNames, ...item.taskSources]
          .filter(Boolean)
          .join('/') || item.taskName;
      return `- ${item.reportDate}｜${item.department}｜${item.personName}｜${target}｜${item.assistanceNeeded}`;
    })
    .join('\n');
};

const formatCompletionItems = (
  items: ManagerAnalysisCompletionItem[],
): string => {
  if (items.length === 0) return '无';
  return items
    .map((item: ManagerAnalysisCompletionItem) => {
      const target: string =
        item.projectNames.filter(Boolean).join('/') || item.taskName;
      return `- ${item.reportDate}｜${item.department}｜${item.personName}｜${target}｜${item.completion}`;
    })
    .join('\n');
};

export function buildManagerAnalysisPrompt(params: {
  context: ManagerAnalysisContext;
  dimension: ManagerAnalysisDimension;
  requirement: string;
}): string {
  const { context, dimension, requirement } = params;
  const totals = context.totals;
  const truncatedNote: string = context.truncated
    ? '，仅展示最近 60 条'
    : '';

  return [
    '你是北京碧海能源装备有限公司（BSS）的管理分析助手。请基于下列工作日报数据，为管理者输出分析。',
    '',
    `【分析范围】${context.rangeLabel} · 数据范围：${context.scopeLabel}`,
    `【分析维度】${MANAGER_ANALYSIS_DIMENSION_LABELS[dimension]}：${DIMENSION_FOCUS[dimension]}`,
    `【管理关注点】${requirement || DEFAULT_REQUIREMENT}`,
    '',
    '【总体统计】',
    `日报 ${totals.reportCount} 条 / 参与 ${totals.peopleCount} 人 / 覆盖 ${totals.departmentCount} 个部门 / 涉及 ${totals.projectCount} 个项目 / 卡点 ${totals.issueCount} 条`,
    '',
    '【按部门】',
    formatDepartments(context.byDepartment),
    '',
    '【任务来源分布】',
    formatMetrics(context.byTaskSource),
    '',
    '【项目分布】',
    formatMetrics(context.byProject),
    '',
    `【卡点明细】（共 ${context.issueItems.length} 条${truncatedNote}）`,
    formatIssueItems(context.issueItems),
    '',
    `【完成情况摘录】（共 ${context.completionItems.length} 条${truncatedNote}）`,
    formatCompletionItems(context.completionItems),
    '',
    '【输出要求】',
    '1. 使用 Markdown，用二级标题（##）分节，不要输出代码块；',
    '2. 必须包含四节：## 总体结论、## 卡点分析、## 完成情况、## 管理建议；',
    '3. 卡点分析按指定维度归并，指出高频或高风险卡点，说明涉及的部门、人员与项目/任务来源及其影响；',
    '4. 完成情况按同一维度归纳推进顺利与滞后的部分，引用具体项目或任务来源；',
    '5. 只使用给定数据，不得编造数字或人名；数据不足以判断时明确说明；',
    '6. 管理建议给出不超过 5 条可执行动作，每条一句话；',
    '7. 全文控制在 900 字以内，不要重复罗列原始清单。',
  ].join('\n');
}

export async function streamManagerAnalysis(params: {
  context: ManagerAnalysisContext;
  dimension: ManagerAnalysisDimension;
  requirement: string;
  onProgress?: (text: string) => void;
}): Promise<string> {
  const prompt: string = buildManagerAnalysisPrompt(params);
  const stream = capabilityClient
    .load(MANAGER_ANALYSIS_PLUGIN_ID)
    .callStream('textGenerate', { prompt });

  let accumulated = '';
  for await (const chunk of normalizeStream(stream)) {
    const piece = typeof chunk.content === 'string' ? chunk.content : '';
    if (!piece) continue;
    accumulated += piece;
    params.onProgress?.(accumulated);
  }

  if (!accumulated.trim()) {
    logger.error('管理者看板 AI 分析返回为空');
    throw new Error('AI 未返回分析内容，请重试');
  }
  return accumulated;
}
