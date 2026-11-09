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
import { ROLE_SUBJECT, useAuth } from '@lark-apaas/client-toolkit/auth';
import { getApiErrorMessage } from '@/lib/api-error';
import { buildWeeklyTemplateData, type TemplateNarrative } from '@/lib/report-template';
import { generateTemplateNarrative } from '@/lib/report-template-ai';
import { weeklyReportApi } from '@/api';
import aiAvatarUrl from '@/assets/ai-assistant.png';
import {
  DEPARTMENTS,
  type DailyReport,
  type ReportNextPlanRow,
  type WeeklyReport,
  type WeeklyReportListQuery,
  type WeeklyReportListResponse,
  type WeeklyTemplateData,
} from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';

const formatDateRange = (start: string, end: string): string => {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  return `${fmt(s)} ~ ${fmt(e)}`;
};

const getMonday = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

const formatDate = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getPreviousWeekStart = (weekStartIso: string): string => {
  const date = new Date(`${weekStartIso}T00:00:00`);
  date.setDate(date.getDate() - 7);
  return formatDate(date);
};

interface GenerateWeeklyOutcome {
  report: WeeklyReport;
  templateApplied: boolean;
  templateErrorMessage?: string;
}

const generateWeeklyWithTemplate = async (
  weekStartValue: string,
): Promise<GenerateWeeklyOutcome> => {
  const report: WeeklyReport = await weeklyReportApi.generateWeeklyReport({
    weekStart: weekStartValue,
  });
  try {
    const detail: WeeklyReport = await weeklyReportApi.getWeeklyReport(
      report.id,
    );
    const reports: DailyReport[] = detail.dailyReports ?? [];
    const previousList: WeeklyReportListResponse =
      await weeklyReportApi.getWeeklyReports({
        weekStart: getPreviousWeekStart(weekStartValue),
        pageSize: 1,
      });
    const previousPlanRows: ReportNextPlanRow[] =
      previousList.items[0]?.templateData?.nextPlanRows ?? [];
    const narrative: TemplateNarrative = await generateTemplateNarrative({
      period: 'week',
      reports,
    });
    const templateData: WeeklyTemplateData = buildWeeklyTemplateData(reports, {
      previousPlanRows,
      summaryPoints: narrative.summaryPoints,
      nextPlanRows: narrative.nextPlanRows,
    });
    await weeklyReportApi.updateWeeklyTemplate(report.id, templateData);
    return { report, templateApplied: true };
  } catch (error) {
    logger.error('周报模板内容生成失败', error);
    return {
      report,
      templateApplied: false,
      templateErrorMessage: getApiErrorMessage(error, '请稍后重试'),
    };
  }
};

const MyWeeklyReports: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultWeekStart = formatDate(getMonday(new Date()));
  const [weekStart, setWeekStart] = useState(
    searchParams.get('weekStart') || defaultWeekStart,
  );

  const page = Number(searchParams.get('page') || 1);
  const pageSize = Number(searchParams.get('pageSize') || 10);

  const query: WeeklyReportListQuery = useMemo(() => {
    const q: WeeklyReportListQuery = { page, pageSize };
    const department = searchParams.get('department');
    if (department) q.department = department;
    if (weekStart) q.weekStart = weekStart;
    return q;
  }, [searchParams, page, pageSize, weekStart]);

  const { data, isLoading } = useQuery({
    queryKey: ['weekly-reports', query],
    queryFn: () => weeklyReportApi.getWeeklyReports(query),
  });

  const generateMutation = useMutation({
    mutationFn: (start: string) => generateWeeklyWithTemplate(start),
    retry: false,
    onSuccess: (outcome: GenerateWeeklyOutcome) => {
      queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
      queryClient.invalidateQueries({
        queryKey: ['weekly-report', outcome.report.id],
      });
      if (outcome.templateApplied) {
        toast.success('周报及模板内容已生成');
        return;
      }
      toast.error(
        `周报已生成，但模板内容生成失败：${
          outcome.templateErrorMessage ?? '请稍后重试'
        }`,
      );
    },
    onError: (error) => {
      logger.error('周报生成失败', error);
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
    if (!weekStart) {
      toast.error('请选择周起始日期');
      return;
    }
    generateMutation.mutate(weekStart);
  };

  return (
    <div className="space-y-5">
      <EnergyHero
        title="周报管理"
        description="按周自动汇总本周日报，一人一周一条"
        action={
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="shadow-sm"
          >
            <FileText className="size-4" />
            {generateMutation.isPending ? '生成中...' : '生成周报'}
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
                周起始日
              </label>
              <Input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
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
                <TableHead className="font-semibold text-slate-600">周范围</TableHead>
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
                    正在加载周报数据...
                  </TableCell>
                </TableRow>
              ) : data?.items && data.items.length > 0 ? (
                data.items.map((item) => (
                  <TableRow
                    key={item.id}
                    className="transition-colors hover:bg-primary/[0.025]"
                  >
                    <TableCell className="whitespace-nowrap tabular-nums text-slate-700">
                      {formatDateRange(item.weekStart, item.weekEnd)}
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
                        onClick={() => navigate(`/weekly-report/${item.id}`)}
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
                        <EmptyTitle>暂无周报数据</EmptyTitle>
                        <EmptyDescription>
                          点击右上角「生成周报」，按周自动汇总本周日报
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

const WeeklyReportPage: React.FC = () => {
  const { ability, isLoading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab: string =
    searchParams.get('tab') === 'department' ? 'department' : 'mine';
  const isDirector: boolean =
    !authLoading && ability.can('dept_director', ROLE_SUBJECT);
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
          我的周报
        </TabsTrigger>
        {authLoading ? (
          <Skeleton className="h-8 w-24 rounded-md" />
        ) : isDirector ? (
          <TabsTrigger value="department" className="px-4">
            部门周报
          </TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent value="mine" className="space-y-5">
        <MyWeeklyReports />
      </TabsContent>

      {isDirector ? (
        <TabsContent value="department" className="space-y-5">
          <DepartmentReportPanel periodType="weekly" />
        </TabsContent>
      ) : null}
    </Tabs>
  );
};

export default WeeklyReportPage;
