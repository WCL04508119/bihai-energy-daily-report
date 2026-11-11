import { Logger } from '@nestjs/common';
import { CapabilityService } from '@lark-apaas/fullstack-nestjs-core';

import {
  isDepartment,
  isTaskSource,
  formatCompletionRowsProjectTask,
  type DailyReport,
} from '@shared/api.interface';

const BITABLE_INSTANCE_ID = 'work_daily_report_bitable_sync_v2';
const SHANGHAI_SUFFIX = '+08:00';

const logger = new Logger('DailyBitableSync');

interface BitableSearchResult {
  records?: Array<{ id: string }>;
}

const optionalText = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const arrayText = (value?: string[]): string | undefined => {
  if (!value || value.length === 0) return undefined;
  return value.join('、');
};

const toTimestamp = (dateStr: string): number =>
  new Date(`${dateStr}T00:00:00${SHANGHAI_SUFFIX}`).getTime();

export const buildDailyBitableFields = (
  report: DailyReport,
  reporterName?: string,
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
    logger.warn(`日报部门不是合法枚举，跳过同步 id=${report.id}`);
  }
  if (isTaskSource(report.taskSource)) {
    fields['任务来源'] = report.taskSource;
  } else {
    logger.warn(`日报任务来源不是合法枚举，跳过同步 id=${report.id}`);
  }

  const optionalFields: Array<[string, string | undefined]> = [
    ['填报人', optionalText(reporterName)],
    [
      '项目名称/任务名称',
      formatCompletionRowsProjectTask(report.completionRows, report.projectName),
    ],
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

export const syncDailyReportToBitable = async (
  capabilityService: CapabilityService,
  report: DailyReport,
  reporterName?: string,
): Promise<void> => {
  const fields = buildDailyBitableFields(report, reporterName);
  const instance = capabilityService.load(BITABLE_INSTANCE_ID);

  const searchResult = (await instance.call('searchRecords', {
    filter: {
      conjunction: 'and',
      conditions: [
        { fieldName: '日报ID', operator: 'is', value: [report.id] },
      ],
    },
    pageSize: 1,
  })) as BitableSearchResult | undefined;

  const existingId = searchResult?.records?.[0]?.id;
  if (existingId) {
    await instance.call('batchUpdateRecords', {
      records: [{ id: existingId, record: fields }],
    });
    return;
  }
  await instance.call('batchAddRecords', {
    records: [{ record: fields }],
  });
};
