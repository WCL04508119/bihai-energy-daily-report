import { capabilityClient } from '@lark-apaas/client-toolkit';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { DailyReport } from '@shared/api.interface';
import { isDepartment, isTaskSource, formatCompletionRowsProjectTask } from '@shared/api.interface';

/**
 * 日报明细同步到飞书多维表格的插件实例 ID。
 * 实例尚未创建/配置时，load() 会抛 CapabilityNotFoundError，由调用方提示用户。
 */
export const DAILY_BITABLE_PLUGIN_ID = 'work_daily_report_bitable_sync_v2';

interface BitableSearchResponse {
  records: Array<{ id: string; record: Record<string, unknown> }>;
  hasMore: boolean;
  pageToken?: string;
  total: number;
}

const optionalText = (v?: string): string | undefined => {
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
};

const arrayText = (v?: string[]): string | undefined => {
  if (!v || v.length === 0) return undefined;
  return v.join('、');
};

const toTimestamp = (dateStr: string): number =>
  new Date(`${dateStr}T00:00:00`).getTime();

const TRANSIENT_ERROR_PATTERN =
  /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|EPIPE|ENOTFOUND|socket hang up|fetch failed|network error|timed out|timeout|超时/i;

const PLUGIN_WRAPPER_PATTERN = /插件执行失败|Execution failed/i;

const BUSINESS_ERROR_PATTERN =
  /field_name|INVALID_INPUT|recordIDs|not found field|字段类型错误|请求参数错误|无权限|permission/i;

const RETRY_DELAYS = [800, 2000, 4000];

const ERROR_KEYS = [
  'message',
  'errorMsg',
  'errorMessage',
  'detail',
  'cause',
  'error',
  'reason',
  'statusMessage',
  'code',
];

const ERROR_NOISE: Array<[RegExp, string]> = [
  [/Execution failed:\s*/gi, ' '],
  [/「?\s*\[object Object\]\s*」?\s*插件执行失败:?\s*/gi, ' '],
  [/插件执行失败:?\s*/gi, ' '],
  [/\[object Object\]/gi, ' '],
  [/fetch failed\s*\(ETIMEDOUT\)/gi, '飞书接口网络超时'],
  [/fetch failed/gi, '飞书接口网络超时'],
  [/ETIMEDOUT/gi, '网络超时'],
];

const sanitizeErrorText = (text: string): string => {
  let output = text;
  for (const [pattern, replacement] of ERROR_NOISE) {
    output = output.replace(pattern, replacement);
  }
  return output.replace(/[|:]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
};

const flattenError = (
  input: unknown,
  depth: number,
  seen: Set<unknown>,
): string[] => {
  if (input === null || input === undefined || depth > 6) return [];
  if (typeof input === 'string') {
    const text = input.trim();
    return text ? [text] : [];
  }
  if (typeof input !== 'object') return [];
  if (seen.has(input)) return [];
  seen.add(input);

  if (Array.isArray(input)) {
    return input.flatMap((item: unknown) =>
      flattenError(item, depth + 1, seen),
    );
  }

  const record = input as Record<string, unknown>;
  const keys = ERROR_KEYS.filter((key) => record[key] !== undefined);
  if (keys.length === 0) {
    try {
      const text = JSON.stringify(input);
      return text && text !== '{}' ? [text] : [];
    } catch {
      return [];
    }
  }
  return keys.flatMap((key: string) =>
    flattenError(record[key], depth + 1, seen),
  );
};

const collectRawDetail = (error: unknown): string => {
  const parts = flattenError(error, 0, new Set<unknown>()).filter(Boolean);
  return Array.from(new Set(parts)).join(' | ');
};

const collectErrorDetail = (error: unknown): string =>
  sanitizeErrorText(collectRawDetail(error));

/**
 * 插件执行失败时，底层网络超时会被包装成「Execution failed: 「[object Object]」插件执行失败」。
 * 原始错误不含业务参数/字段类错误时，按可重试的瞬时故障处理。
 */
const isTransientNetworkError = (error: unknown): boolean => {
  const raw = collectRawDetail(error);
  if (!raw || BUSINESS_ERROR_PATTERN.test(raw)) return false;
  return (
    TRANSIENT_ERROR_PATTERN.test(raw) ||
    PLUGIN_WRAPPER_PATTERN.test(raw)
  );
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

/** 把插件抛出的错误转成用户能看懂的一句话。 */
export const describeBitableSyncError = (error: unknown): string => {
  const detail = collectErrorDetail(error);
  if (detail.includes('not found field_name')) {
    return '日报已保存，但多维表格同步未完成：表「日报记录」缺少「日报ID」字段，请在 Base 中新增该列（类型：文本）后点击「同步多维表格」重试';
  }
  if (isTransientNetworkError(error)) {
    return `日报已保存，但飞书多维表格同步超时（飞书接口网络波动，已自动重试 ${RETRY_DELAYS.length} 次）。可在日报列表点击「同步多维表格」重新同步`;
  }
  if (detail.includes('recordIDs') || detail.includes('INVALID_INPUT')) {
    return `日报已保存，但多维表格同步参数未被接受：${detail || '未知错误'}`;
  }
  if (!detail) {
    return '日报已保存，但飞书多维表格同步失败，请稍后在日报列表点击「同步多维表格」重试';
  }
  const readable =
    detail.length > 120 ? `${detail.slice(0, 120)}…` : detail;
  return `日报已保存，但飞书多维表格同步失败：${readable}`;
};

const buildDailyRecordFields = (
  report: DailyReport,
  reporterName: string,
): Record<string, unknown> => {
  const fields: Record<string, unknown> = {
    日报ID: report.id,
    填报日期: toTimestamp(report.reportDate),
    任务名称: report.taskName,
    输出文件数量: report.outputFileCount,
  };

  if (isDepartment(report.department)) {
    fields['所属部门'] = report.department;
  } else {
    logger.warn('日报部门不是合法枚举，跳过「所属部门」同步', report.department);
  }
  if (isTaskSource(report.taskSource)) {
    fields['任务来源'] = report.taskSource;
  } else {
    logger.warn('日报任务来源不是合法枚举，跳过「任务来源」同步', report.taskSource);
  }

  const optionalFields: Array<[string, string | undefined]> = [
    ['填报人', optionalText(reporterName)],
    ['项目名称/任务名称', formatCompletionRowsProjectTask(report.completionRows, report.projectName)],
    ['项目编号', arrayText(report.projectCode)],
    ['PLM任务', optionalText(report.plmTask)],
    ['当日完成情况', optionalText(report.dayCompletion)],
    ['需协助事项', optionalText(report.assistanceNeeded)],
  ];
  for (const [name, value] of optionalFields) {
    if (value !== undefined) fields[name] = value;
  }
  return fields;
};

/**
 * 把一条日报同步到飞书多维表格（幂等：按日报ID查已有记录，有则覆盖更新，无则新增）。
 * 应用数据库是主存储，本同步不阻塞日报保存流程；失败由调用方 toast 提示。
 * 飞书接口偶发超时（ETIMEDOUT）时自动重试，业务错误不重试。
 */
export async function syncDailyReportToBitable(params: {
  report: DailyReport;
  reporterName: string;
}): Promise<void> {
  const { report, reporterName } = params;
  const fields = buildDailyRecordFields(report, reporterName);
  const plugin = capabilityClient.load(DAILY_BITABLE_PLUGIN_ID);

  const run = async (): Promise<void> => {
    const searchResult = await plugin.call<BitableSearchResponse>(
      'searchRecords',
      {
        filter: {
          conjunction: 'and',
          conditions: [
            { fieldName: '日报ID', operator: 'is', value: [report.id] },
          ],
        },
        pageSize: 1,
      },
    );

    const existingId = searchResult.records?.[0]?.id;
    if (existingId) {
      await plugin.call('batchUpdateRecords', {
        records: [{ id: existingId, record: fields }],
      });
      logger.info('日报已更新到多维表格', report.id);
      return;
    }

    await plugin.call('batchAddRecords', { records: [{ record: fields }] });
    logger.info('日报已同步到多维表格', report.id);
  };

  for (let attempt = 0; ; attempt += 1) {
    try {
      await run();
      return;
    } catch (error) {
      const canRetry =
        attempt < RETRY_DELAYS.length && isTransientNetworkError(error);
      if (!canRetry) throw error;
      logger.warn(
        `日报同步多维表格超时，第 ${attempt + 1} 次重试`,
        report.id,
      );
      await sleep(RETRY_DELAYS[attempt]);
    }
  }
}
