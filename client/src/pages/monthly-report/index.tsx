import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Eye,
  FileText,
  CalendarDays,
  SlidersHorizontal,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import EnergyHero from '@/components/brand/EnergyHero';
import DepartmentReportPanel from '@/components/department-report/DepartmentReportPanel';
import { useDataScope } from '@/hooks/use-data-scope';
import { getApiErrorMessage } from '@/lib/api-error';
import { buildMonthlyTemplateData, type TemplateNarrative } from '@/lib/report-template';
import { generateTemplateNarrative } from '@/lib/report-template-ai';
import { monthlyReportApi, dailyReportApi } from '@/api';
import aiAvatarUrl from '@/assets/ai-assistant.png';
import {
  DEPARTMENTS,
  type DailyReport,
  type MonthlyReport,
  type MonthlyReportListQuery,
  type MonthlyTemplateData,
  type ReportNextPlanRow,
} from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';

const formatMonthLabel = (month: string): string => {
  const [year, m] = month.split('-');
  return `${year}年${Number(m)}月`;
};

const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

const MONTHLY_REPORT_PAGE_SIZE = 100;
const MONTHLY_REPORT_MAX_PAGES = 5;

const fetchMonthDailyReports = async (
  reporterId: string,
  reportMonthValue: string,
): Promise<DailyReport[]> => {
  const [year, monthNumber] = reportMonthValue
    .split('-')
    .map((part: string) => Number(part));
  const startDate: string = formatIsoDate(new Date(year, monthNumber - 1, 1));
  const endDate: string = formatIsoDate(new Date(year, monthNumber, 0));
  const collected: DailyReport[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (collected.length < total && page <= MONTHLY_REPORT_MAX_PAGES) {
    const response = await dailyReportApi.getDailyReports({
      reporterId,
      startDate,
      endDate,
      page,
      pageSize: MONTHLY_REPORT_PAGE_SIZE,
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

const fetchPreviousMonthPlanRows = async (
  reporterId: string,
  reportMonthValue: string,
): Promise<ReportNextPlanRow[]> => {
  const [year, month] = reportMonthValue.split('-').map(Number);
  const previousMonth: string =
    month <= 1
      ? `${year - 1}-12`
      : `${year}-${String(month - 1).padStart(2, '0')}`;
  try {
    const response = await monthlyReportApi.getMonthlyReports({
      reporterId,
      reportMonth: previousMonth,
      pageSize: 1,
    });
    return response.items[0]?.templateData?.nextPlanRows ?? [];
  } catch (error) {
    logger.warn('读取上月月报计划失败，将按空计划生成', error);
    return [];
  }
};

interface GenerateMonthlyOutcome {
  report: MonthlyReport;
  templateApplied: boolean;
  templateErrorMessage?: string;
}

const generateMonthlyWithTemplate = async (
  reportMonthValue: string,
): Promise<GenerateMonthlyOutcome> => {
  const report: MonthlyReport = await monthlyReportApi.generateMonthlyReport({
    reportMonth: reportMonthValue,
  });
  try {
    const reports: DailyReport[] = await fetchMonthDailyReports(
      report.reporterId,
      report.reportMonth,
    );
    const narrative: TemplateNarrative = await generateTemplateNarrative({
      period: 'month',
      reports,
    });
    const previousPlanRows: ReportNextPlanRow[] =
      await fetchPreviousMonthPlanRows(report.reporterId, report.reportMonth);
    const templateData: MonthlyTemplateData = buildMonthlyTemplateData(
      reports,
      {
        previousPlanRows,
        summaryPoints: narrative.summaryPoints,
        nextPlanRows: narrative.nextPlanRows,
      },
    );
    await monthlyReportApi.updateMonthlyTemplate(report.id, templateData);
    return { report, templateApplied: true };
  } catch (error) {
    logger.error('月报模板内容生成失败', error);
    return {
      report,
      templateApplied: false,
      templateErrorMessage: getApiErrorMessage(error, '请稍后重试'),
    };
  }
};

const MyMonthlyReports: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultMonth = getCurrentMonth();
  const [reportMonth, setReportMonth] = useState(
    searchParams.get('reportMonth') || defaultMonth,
  );

  const page = Number(searchParams.get('page') || 1);
  const pageSize = Number(searchParams.get('pageSize') || 10);

  const query: MonthlyReportListQuery = useMemo(() => {
    const q: MonthlyReportListQuery = { page, pageSize };
    const department = searchParams.get('department');
    if (department) q.department = department;
    if (reportMonth) q.reportMonth = reportMonth;
    return q;
  }, [searchParams, page, pageSize, reportMonth]);

  const { data, isLoading } = useQuery({
    queryKey: ['monthly-reports', query],
    queryFn: () => monthlyReportApi.getMonthlyReports(query),
  });

  const generateMutation = useMutation({
    mutationFn: (month: string) => generateMonthlyWithTemplate(month),
    retry: false,
    onSuccess: (outcome: GenerateMonthlyOutcome) => {
      queryClient.invalidateQueries({ queryKey: ['monthly-reports'] });
      queryClient.invalidateQueries({
        queryKey: ['monthly-report', outcome.report.id],
      });
      if (outcome.templateApplied) {
        toast.success('月报及模板内容已生成');
        return;
      }
      toast.error(
        `月报已生成，但模板内容生成失败：${
          outcome.templateErrorMessage ?? '请稍后重试'
        }`,
      );
    },
    onError: (error) => {
      logger.error('月报生成失败', error);
      toast.error(getApiErrorMessage(error, '生成失败，请稍后重试'));
    },
  });

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  const goToPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
  };

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  const handleGenerate = () => {
    if (!reportMonth) {
      toast.error('请选择月份');
      return;
    }
    generateMutation.mutate(reportMonth);
  };

  return (
    <div className="space-y-5">
      <EnergyHero
        title="月报管理"
        description="按月自动汇总本月日报，一人一月一条"
        action={
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="shadow-sm"
          >
            <FileText className="size-4" />
            {generateMutation.isPending ? '生成中...' : '生成月报'}
          </Button>
        }
      />

      <Card className="animate-fade-up stagger-1">
        <CardContent className="p-4 lg:p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
            <SlidersHorizontal className="size-4 text-primary" />
            筛选条件
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <CalendarDays className="size-3.5" />
                月份
              </label>
              <Input
                type="month"
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Building2 className="size-3.5" />
                部门
              </label>
              <Select
                value={searchParams.get('department') || ''}
                onValueChange={(v) => updateFilter('department', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="全部部门" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="animate-fade-up stagger-2 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                <TableHead className="font-semibold text-slate-600">月份</TableHead>
                <TableHead className="font-semibold text-slate-600">部门</TableHead>
                <TableHead className="w-24 font-semibold text-slate-600">日报数量</TableHead>
                <TableHead className="w-24 text-right font-semibold text-slate-600">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-16 text-center text-sm text-slate-500"
                  >
                    正在加载月报数据...
                  </TableCell>
                </TableRow>
              ) : data?.items && data.items.length > 0 ? (
                data.items.map((item) => (
                  <TableRow
                    key={item.id}
                    className="transition-colors hover:bg-primary/[0.025]"
                  >
                    <TableCell className="whitespace-nowrap font-medium text-slate-800">
                      {formatMonthLabel(item.reportMonth)}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {item.department}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums text-slate-700">
                      {item.reportCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="查看详情"
                        className="text-slate-500 hover:bg-primary/10 hover:text-primary"
                        onClick={() => navigate(`/monthly-report/${item.id}`)}
                      >
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="py-14">
                    <Empty>
                      <EmptyHeader>
                        <div className="mb-2 flex justify-center">
                          <Image
                            src={aiAvatarUrl}
                            alt="BSS 智能助手形象"
                            className="size-16 rounded-full object-cover shadow-sm ring-2 ring-primary/10"
                          />
                        </div>
                        <EmptyTitle>暂无月报数据</EmptyTitle>
                        <EmptyDescription>
                          点击右上角「生成月报」，按月自动汇总本月日报
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data && data.total > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            共 {data.total} 条，第 {data.page} / {totalPages} 页
          </span>
          <Pagination className="justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => goToPage(Math.max(1, page - 1))}
                  aria-disabled={page <= 1}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 || p === totalPages || Math.abs(p - page) <= 1,
                )
                .map((p, idx, arr) => (
                  <div key={p} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <PaginationItem>
                        <span className="px-2 text-slate-400">...</span>
                      </PaginationItem>
                    )}
                    <PaginationItem>
                      <PaginationLink isActive={p === page} onClick={() => goToPage(p)}>
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  </div>
                ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => goToPage(Math.min(totalPages, page + 1))}
                  aria-disabled={page >= totalPages}
                  className={
                    page >= totalPages ? 'pointer-events-none opacity-50' : ''
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

const MonthlyReportPage: React.FC = () => {
  const { data: scope, isLoading: scopeLoading } = useDataScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab: string =
    searchParams.get('tab') === 'department' ? 'department' : 'mine';
  const isDirector: boolean =
    !scopeLoading &&
    (scope?.kind === 'all' || scope?.kind === 'department');
  const activeTab: string = isDirector ? requestedTab : 'mine';

  const handleTabChange = (value: string): void => {
    const next = new URLSearchParams(searchParams);
    if (value === 'department') {
      next.set('tab', 'department');
    } else {
      next.delete('tab');
    }
    setSearchParams(next);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-5">
      <TabsList className="h-10 w-fit gap-1 bg-slate-100/80 p-1">
        <TabsTrigger value="mine" className="px-4">
          我的月报
        </TabsTrigger>
        {scopeLoading ? (
          <Skeleton className="h-8 w-24 rounded-md" />
        ) : isDirector ? (
          <TabsTrigger value="department" className="px-4">
            部门月报
          </TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent value="mine" className="space-y-5">
        <MyMonthlyReports />
      </TabsContent>

      {isDirector ? (
        <TabsContent value="department" className="space-y-5">
          <DepartmentReportPanel periodType="monthly" />
        </TabsContent>
      ) : null}
    </Tabs>
  );
};

export default MonthlyReportPage;
