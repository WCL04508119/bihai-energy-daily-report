import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Building2, CalendarDays, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';

import { capabilityClient } from '@lark-apaas/client-toolkit';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Markdown } from '@/components/ui/markdown';
import WeeklyReportTemplate from '@/components/report-template/WeeklyReportTemplate';
import MonthlyReportTemplate from '@/components/report-template/MonthlyReportTemplate';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  buildMonthlyTemplateData,
  buildWeeklyTemplateData,
  type TemplateNarrative,
} from '@/lib/report-template';
import { generateTemplateNarrative } from '@/lib/report-template-ai';
import * as departmentReportApi from '@/api/department-report';
import { getDailyReports } from '@/api/daily-report';
import { getIssueReports } from '@/utils/report-group';
import {
  getCurrentMonthIso,
  getPeriodRange,
  getWeekStartIso,
  type ReportPeriodType,
} from '@/lib/period';
import {
  DEPARTMENTS,
  TASK_SOURCES,
  isDepartment,
  type DailyReport,
  type Department,
  type DepartmentMonthlyReport,
  type DepartmentWeeklyReport,
  type MonthlyTemplateData,
  type ReportNextPlanRow,
  type TaskSource,
  type WeeklyTemplateData,
} from '@shared/api.interface';

type AnyRecord = Record<string, unknown>;

interface CreatedDepartmentReport {
  department: Department;
  periodValue: string;
}

interface GenerateDepartmentReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodType: ReportPeriodType;
  onCreated: (created: CreatedDepartmentReport) => void;
}

const PLUGIN_INSTANCE_ID = 'bihai_smart_employee_daily_report_1';
const DAILY_REPORT_PAGE_SIZE = 100;
const DAILY_REPORT_MAX_PAGES = 30;

const isAsyncIterable = (value: unknown): value is AsyncIterable<AnyRecord> => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { [Symbol.asyncIterator]?: unknown };
  return typeof candidate[Symbol.asyncIterator] === 'function';
};

const normalizeStream = (resultOrStream: unknown): AsyncIterable<AnyRecord> => {
  if (isAsyncIterable(resultOrStream)) return resultOrStream;
  if (
    typeof resultOrStream === 'object' &&
    resultOrStream !== null &&
    'output' in resultOrStream
  ) {
    const output = (resultOrStream as { output?: unknown }).output;
    if (isAsyncIterable(output)) return output;
  }
  throw new Error('Invalid callStream result');
};

const streamText = async (
  prompt: string,
  onUpdate: (text: string) => void,
): Promise<string> => {
  const stream = capabilityClient
    .load(PLUGIN_INSTANCE_ID)
    .callStream('textGenerate', { prompt });
  let accumulated = '';
  for await (const chunk of normalizeStream(stream)) {
    const piece = typeof chunk.content === 'string' ? chunk.content : '';
    if (!piece) continue;
    accumulated += piece;
    onUpdate(accumulated);
  }
  return accumulated;
};

const describeError = (error: unknown, fallback: string): string => {
  const apiMessage: string = getApiErrorMessage(error, '');
  if (apiMessage) return apiMessage;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
};

const fetchAllDepartmentReports = async (
  department: Department,
  startDate: string,
  endDate: string,
): Promise<DailyReport[]> => {
  const collected: DailyReport[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (collected.length < total && page <= DAILY_REPORT_MAX_PAGES) {
    const response = await getDailyReports({
      department,
      startDate,
      endDate,
      page,
      pageSize: DAILY_REPORT_PAGE_SIZE,
    });
    collected.push(...response.items);
    total = response.total;
    if (response.items.length === 0) break;
    page += 1;
  }
  return collected.sort((a: DailyReport, b: DailyReport) =>
    a.reportDate.localeCompare(b.reportDate),
  );
};

const fetchPreviousWeekPlanRows = async (
  department: Department,
  weekStartValue: string,
): Promise<ReportNextPlanRow[]> => {
  try {
    const previousWeekStart: string = dayjs(weekStartValue)
      .subtract(7, 'day')
      .format('YYYY-MM-DD');
    const response = await departmentReportApi.getDepartmentWeeklyReports({
      department,
      weekStart: previousWeekStart,
      pageSize: 1,
    });
    return response.items[0]?.templateData?.nextPlanRows ?? [];
  } catch (error) {
    logger.warn('读取上周部门周报计划失败，将按空计划生成', error);
    return [];
  }
};

const fetchPreviousMonthPlanRows = async (
  department: Department,
  reportMonthValue: string,
): Promise<ReportNextPlanRow[]> => {
  try {
    const previousMonth: string = dayjs(`${reportMonthValue}-01`)
      .subtract(1, 'month')
      .format('YYYY-MM');
    const response = await departmentReportApi.getDepartmentMonthlyReports({
      department,
      reportMonth: previousMonth,
      pageSize: 1,
    });
    return response.items[0]?.templateData?.nextPlanRows ?? [];
  } catch (error) {
    logger.warn('读取上月部门月报计划失败，将按空计划生成', error);
    return [];
  }
};

const buildSourceBreakdown = (reports: DailyReport[]): string => {
  const sections: string[] = [];
  TASK_SOURCES.forEach((source: TaskSource) => {
    const group: DailyReport[] = reports.filter(
      (report: DailyReport) => report.taskSource === source,
    );
    if (group.length === 0) return;
    const lines: string = group
      .map(
        (report: DailyReport) =>
          `  - ${report.reportDate}｜任务：${report.taskName}｜项目：${
            report.projectName?.length
              ? report.projectName.join('、')
              : '未关联项目'
          }｜完成说明：${report.dayCompletion || '未填写'}`,
      )
      .join('\n');
    sections.push(`【${source}】共 ${group.length} 条\n${lines}`);
  });
  return sections.length > 0 ? sections.join('\n\n') : '（本期日报无任务来源记录）';
};

const buildIssueBreakdown = (reports: DailyReport[]): string => {
  const issueReports: DailyReport[] = getIssueReports(reports);
  if (issueReports.length === 0) return '（本期日报未记录卡点与所需支持）';
  return issueReports
    .map(
      (report: DailyReport) =>
        `- ${report.reportDate}｜任务：${report.taskName}｜任务来源：${
          report.taskSource
        }｜需协助事项：${report.assistanceNeeded || '未填写'}`,
    )
    .join('\n');
};

const buildSummaryPrompt = (params: {
  department: Department;
  periodText: string;
  startDate: string;
  endDate: string;
  reports: DailyReport[];
}): string => `你是一名企业部门工作总结助手，服务对象是北京碧海能源装备有限公司的部门负责人（室主任）。请根据${params.department}在 ${params.startDate} 至 ${params.endDate} 内的 ${params.reports.length} 条员工日报，撰写该部门${params.periodText}「部门工作总结」。

要求：
1. 按任务来源分小节（部门日常、项目任务、投标项目、临时需求、会议安排、跨部门协作），只写有记录的来源。
2. 每个小节 2-4 句话，突出${params.periodText}的进展、产出与成果，可引用任务条目、完成说明等数据。
3. 语言正式、面向管理层，不编造日报中不存在的事实，信息缺失处不要臆测。
4. 使用 Markdown 输出，使用三级标题作为小节标题，不要输出与总结无关的说明。

任务来源分组明细：
${buildSourceBreakdown(params.reports)}`;

const buildIssuesPrompt = (params: {
  department: Department;
  periodText: string;
  startDate: string;
  endDate: string;
  reports: DailyReport[];
}): string => `你是一名企业部门风险分析助手，服务对象是北京碧海能源装备有限公司的部门负责人（室主任）。请根据${params.department}在 ${params.startDate} 至 ${params.endDate} 内的员工日报记录，撰写该部门${params.periodText}「卡点、瓶颈与问题分析」。

要求：
1. 按问题类别归纳（如进度偏差、资源与人力、跨部门协作、技术难点），不要简单罗列。
2. 每条问题说明：现象、影响、建议的支持或措施。
3. 只依据下面提供的卡点记录，不编造未出现的问题；记录为空时明确说明${params.periodText}无明显卡点。
4. 使用 Markdown 输出，使用三级标题分组，条目使用列表。

卡点记录：
${buildIssueBreakdown(params.reports)}`;

const GenerateDepartmentReportDialog: React.FC<
  GenerateDepartmentReportDialogProps
> = ({ open, onOpenChange, periodType, onCreated }) => {
  const [department, setDepartment] = useState<Department | ''>('');
  const [weekStart, setWeekStart] = useState<string>(getWeekStartIso());
  const [reportMonth, setReportMonth] = useState<string>(getCurrentMonthIso());
  const [summary, setSummary] = useState<string>('');
  const [issues, setIssues] = useState<string>('');
  const [reportCount, setReportCount] = useState<number>(0);
  const [stageLabel, setStageLabel] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [weeklyTemplateData, setWeeklyTemplateData] =
    useState<WeeklyTemplateData | null>(null);
  const [monthlyTemplateData, setMonthlyTemplateData] =
    useState<MonthlyTemplateData | null>(null);

  const isWeekly: boolean = periodType === 'weekly';
  const periodValue: string = isWeekly ? weekStart : reportMonth;
  const canGenerate: boolean =
    department !== '' && periodValue !== '' && !isGenerating;

  const resetState = (): void => {
    setDepartment('');
    setWeekStart(getWeekStartIso());
    setReportMonth(getCurrentMonthIso());
    setSummary('');
    setIssues('');
    setReportCount(0);
    setStageLabel('');
    setErrorMessage('');
    setWeeklyTemplateData(null);
    setMonthlyTemplateData(null);
  };

  const handleOpenChange = (nextOpen: boolean): void => {
    if (isGenerating) return;
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  };

  const saveMutation = useMutation({
    mutationFn: (): Promise<DepartmentWeeklyReport | DepartmentMonthlyReport> => {
      if (!department) {
        return Promise.reject(new Error('请选择部门'));
      }
      const summaryText: string = summary.trim();
      if (!summaryText) {
        return Promise.reject(new Error('请先生成部门工作总结'));
      }
      const issuesText: string = issues.trim();
      if (isWeekly) {
        return departmentReportApi.createDepartmentWeeklyReport({
          department,
          weekStart,
          summaryContent: summaryText,
          issuesSummary: issuesText || undefined,
          templateData: weeklyTemplateData ?? undefined,
        });
      }
      return departmentReportApi.createDepartmentMonthlyReport({
        department,
        reportMonth,
        summaryContent: summaryText,
        issuesSummary: issuesText || undefined,
        templateData: monthlyTemplateData ?? undefined,
      });
    },
    retry: false,
    onSuccess: () => {
      toast.success('部门报告已保存');
      if (department) {
        onCreated({ department, periodValue });
      }
      onOpenChange(false);
      resetState();
    },
    onError: (error: unknown) => {
      logger.error('部门报告保存失败', error);
      const message: string = describeError(error, '保存失败，请稍后重试');
      setErrorMessage(message);
      toast.error(message);
    },
  });

  const handleGenerate = async (): Promise<void> => {
    if (!department || !periodValue || isGenerating) return;
    setIsGenerating(true);
    setSummary('');
    setIssues('');
    setReportCount(0);
    setErrorMessage('');
    setWeeklyTemplateData(null);
    setMonthlyTemplateData(null);
    setStageLabel('正在读取该部门周期内日报…');
    const periodText: string = isWeekly ? '本周' : '本月';
    const range = getPeriodRange(periodType, periodValue);

    try {
      const reports: DailyReport[] = await fetchAllDepartmentReports(
        department,
        range.startDate,
        range.endDate,
      );
      if (reports.length === 0) {
        setStageLabel('');
        setErrorMessage('该部门在所选周期内没有日报，无法生成部门报告');
        toast.error('该部门在所选周期内没有日报');
        return;
      }
      setReportCount(reports.length);

      const failures: string[] = [];

      try {
        setStageLabel('正在按模板汇总本期日报…');
        const previousPlanRows: ReportNextPlanRow[] = isWeekly
          ? await fetchPreviousWeekPlanRows(department, weekStart)
          : await fetchPreviousMonthPlanRows(department, reportMonth);
        if (isWeekly) {
          setStageLabel('正在生成模板总结与下周计划…');
          const weeklyNarrative: TemplateNarrative =
            await generateTemplateNarrative({ period: 'week', reports });
          const weeklyData: WeeklyTemplateData = buildWeeklyTemplateData(
            reports,
            {
              previousPlanRows,
              summaryPoints: weeklyNarrative.summaryPoints,
              nextPlanRows: weeklyNarrative.nextPlanRows,
            },
          );
          setWeeklyTemplateData(weeklyData);
        } else {
          setStageLabel('正在生成模板总结…');
          const monthlyNarrative: TemplateNarrative =
            await generateTemplateNarrative({ period: 'month', reports });
          const monthlyData: MonthlyTemplateData = buildMonthlyTemplateData(
            reports,
            {
              previousPlanRows,
              summaryPoints: monthlyNarrative.summaryPoints,
              nextPlanRows: monthlyNarrative.nextPlanRows,
            },
          );
          setMonthlyTemplateData(monthlyData);
        }
      } catch (error) {
        logger.error('部门报告模板内容生成失败', error);
        failures.push(`模板内容生成失败：${describeError(error, '请稍后重试')}`);
      }

      setStageLabel('正在生成部门工作总结…');
      try {
        const summaryText: string = await streamText(
          buildSummaryPrompt({
            department,
            periodText,
            startDate: range.startDate,
            endDate: range.endDate,
            reports,
          }),
          (text: string) => setSummary(text),
        );
        if (!summaryText.trim()) {
          throw new Error('AI 未返回工作总结内容，请重试');
        }
        setSummary(summaryText);
      } catch (error) {
        logger.error('部门工作总结生成失败', error);
        failures.push(
          `部门工作总结生成失败：${describeError(error, '请稍后重试')}`,
        );
      }

      setStageLabel('正在分析卡点、瓶颈与问题…');
      try {
        const issuesText: string = await streamText(
          buildIssuesPrompt({
            department,
            periodText,
            startDate: range.startDate,
            endDate: range.endDate,
            reports,
          }),
          (text: string) => setIssues(text),
        );
        if (issuesText.trim()) setIssues(issuesText);
      } catch (error) {
        logger.error('部门卡点问题生成失败', error);
        failures.push(
          `卡点问题分析生成失败：${describeError(error, '请稍后重试')}`,
        );
      }

      setStageLabel('');
      if (failures.length > 0) {
        const message: string = failures.join('；');
        setErrorMessage(message);
        toast.error(message);
      }
    } catch (error) {
      logger.error('部门报告生成失败', error);
      const message: string = describeError(error, 'AI 生成失败，请稍后重试');
      setErrorMessage(message);
      setStageLabel('');
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const title: string = isWeekly ? '生成部门周报' : '生成部门月报';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="size-5 text-primary" aria-hidden />
            {title}
          </DialogTitle>
          <DialogDescription>
            选择部门与周期，系统将汇总该周期内的员工日报，生成模板内容与部门工作总结、卡点分析。
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="department-report-department"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500"
            >
              <Building2 className="size-3.5" aria-hidden />
              部门
            </label>
            <Select
              value={department}
              onValueChange={(value: string) =>
                setDepartment(isDepartment(value) ? value : '')
              }
            >
              <SelectTrigger id="department-report-department" className="w-full">
                <SelectValue placeholder="请选择部门" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((item: Department) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="department-report-period"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500"
            >
              <CalendarDays className="size-3.5" aria-hidden />
              {isWeekly ? '周起始日（周一）' : '月份'}
            </label>
            <Input
              id="department-report-period"
              type={isWeekly ? 'date' : 'month'}
              value={periodValue}
              onChange={(event) =>
                isWeekly
                  ? setWeekStart(event.target.value)
                  : setReportMonth(event.target.value)
              }
            />
          </div>
        </div>

        {reportCount > 0 ? (
          <p className="text-xs text-slate-500">
            已读取该部门本期日报 {reportCount} 条
          </p>
        ) : null}

        {stageLabel ? (
          <p className="flex items-center gap-2 text-sm text-primary">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {stageLabel}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">部门工作总结</h3>
          <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-slate-50/60 p-4">
            {summary ? (
              <Markdown className="text-sm leading-relaxed text-slate-700">
                {summary}
              </Markdown>
            ) : (
              <p className="text-xs text-slate-400">
                生成后在此展示部门工作总结
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">
            卡点、瓶颈与问题分析
          </h3>
          <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-slate-50/60 p-4">
            {issues ? (
              <Markdown className="text-sm leading-relaxed text-slate-700">
                {issues}
              </Markdown>
            ) : (
              <p className="text-xs text-slate-400">
                生成后在此展示卡点与问题分析
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">模板预览</h3>
          <div className="max-h-[320px] overflow-y-auto rounded-xl border border-slate-200">
            {isWeekly ? (
              weeklyTemplateData ? (
                <WeeklyReportTemplate templateData={weeklyTemplateData} />
              ) : (
                <p className="p-4 text-xs text-slate-500">
                  生成后在此展示周报模板内容
                </p>
              )
            ) : monthlyTemplateData ? (
              <MonthlyReportTemplate templateData={monthlyTemplateData} />
            ) : (
              <p className="p-4 text-xs text-slate-500">
                生成后在此展示月报模板内容
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isGenerating}
          >
            取消
          </Button>
          <Button
            variant="secondary"
            onClick={handleGenerate}
            disabled={!canGenerate}
          >
            {isGenerating ? '生成中...' : summary ? '重新生成' : '开始生成'}
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!summary.trim() || isGenerating || saveMutation.isPending}
          >
            {saveMutation.isPending ? '保存中...' : '保存部门报告'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GenerateDepartmentReportDialog;
