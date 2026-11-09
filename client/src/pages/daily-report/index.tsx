import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Eye,
  Pencil,
  Trash2,
  SlidersHorizontal,
  CalendarDays,
  Building2,
  RefreshCw,
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
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/brand/PageHeader';
import WelcomeHero from '@/components/brand/WelcomeHero';
import ScheduledSendsCard from '@/components/scheduled/ScheduledSendsCard';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  syncDailyReportToBitable,
  describeBitableSyncError,
} from '@/lib/daily-bitable-sync';
import { dailyReportApi } from '@/api';
import aiAvatarUrl from '@/assets/ai-assistant.png';
import {
  DEPARTMENTS,
  COMPLETION_STATUSES,
  type DailyReport,
  type DailyReportListQuery,
} from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';

const statusStyle: Record<string, string> = {
  按计划完成: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  提前完成: 'border-sky-200 bg-sky-50 text-sky-700',
  部分完成: 'border-amber-200 bg-amber-50 text-amber-700',
  未完成: 'border-rose-200 bg-rose-50 text-rose-700',
  无计划事项: 'border-slate-200 bg-slate-100 text-slate-600',
};

const DailyReportPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const page = Number(searchParams.get('page') || 1);
  const pageSize = Number(searchParams.get('pageSize') || 10);

  const query: DailyReportListQuery = useMemo(() => {
    const q: DailyReportListQuery = { page, pageSize };
    const department = searchParams.get('department');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if (department) q.department = department;
    if (startDate) q.startDate = startDate;
    if (endDate) q.endDate = endDate;
    return q;
  }, [searchParams, page, pageSize]);

  const { data, isLoading } = useQuery({
    queryKey: ['daily-reports', query],
    queryFn: () => dailyReportApi.getDailyReports(query),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dailyReportApi.deleteDailyReport(id),
    retry: false,
    onSuccess: () => {
      toast.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['daily-reports'] });
      setDeleteId(null);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, '删除失败，请稍后重试'));
    },
  });

  const updateFilter = (key: string, value: string) => {    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  const handleSyncToBitable = async (item: DailyReport): Promise<void> => {
    setSyncingId(item.id);
    try {
      await syncDailyReportToBitable({
        report: item,
        reporterName: item.reporterName ?? '',
      });
      toast.success('已同步到多维表格');
    } catch (error) {
      logger.error('日报同步多维表格失败', error);
      toast.error(describeBitableSyncError(error));
    } finally {
      setSyncingId(null);
    }
  };

  const goToPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
  };

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-5">
      <WelcomeHero />

      <div className="animate-fade-up">
        <PageHeader
          title="日报管理"
          description="记录每日工作进展，系统自动汇总为周报与月报"
          action={
            <Button asChild className="shadow-sm">
              <Link to="/daily-report/new">
                <Plus className="size-4" />
                新建日报
              </Link>
            </Button>
          }
        />
      </div>

      <Card className="animate-fade-up stagger-1">
        <CardContent className="p-4 lg:p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
            <SlidersHorizontal className="size-4 text-primary" />
            筛选条件
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <CalendarDays className="size-3.5" />
                开始日期
              </label>
              <Input
                type="date"
                value={searchParams.get('startDate') || ''}
                onChange={(e) => updateFilter('startDate', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <CalendarDays className="size-3.5" />
                结束日期
              </label>
              <Input
                type="date"
                value={searchParams.get('endDate') || ''}
                onChange={(e) => updateFilter('endDate', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <ScheduledSendsCard />

      <Card className="animate-fade-up stagger-2 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                <TableHead className="font-semibold text-slate-600">填报日期</TableHead>
                <TableHead className="font-semibold text-slate-600">部门</TableHead>
                <TableHead className="font-semibold text-slate-600">任务名称</TableHead>
                <TableHead className="font-semibold text-slate-600">项目名称</TableHead>
                <TableHead className="w-40 text-right font-semibold text-slate-600">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center text-sm text-slate-500">
                    正在加载日报数据...
                  </TableCell>
                </TableRow>
              ) : data?.items && data.items.length > 0 ? (
                data.items.map((item) => (
                  <TableRow
                    key={item.id}
                    className="transition-colors hover:bg-primary/[0.025]"
                  >
                    <TableCell className="whitespace-nowrap tabular-nums text-slate-700">
                      {item.reportDate}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {item.department}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-medium text-slate-800">
                      {item.taskName}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-slate-600">
                      {item.projectName?.length ? item.projectName.join('、') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="查看"
                          className="text-slate-500 hover:bg-primary/10 hover:text-primary"
                          onClick={() => navigate(`/daily-report/${item.id}`)}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="编辑"
                          className="text-slate-500 hover:bg-primary/10 hover:text-primary"
                          onClick={() => navigate(`/daily-report/${item.id}/edit`)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="同步多维表格"
                          disabled={syncingId === item.id}
                          className="text-slate-500 hover:bg-primary/10 hover:text-primary"
                          onClick={() => void handleSyncToBitable(item)}
                        >
                          <RefreshCw
                            className={`size-4 ${
                              syncingId === item.id ? 'animate-spin' : ''
                            }`}
                          />
                        </Button>
                        <AlertDialog open={deleteId === item.id} onOpenChange={(o) => !o && setDeleteId(null)}>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="删除"
                              className="text-slate-400 hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleteId(item.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>确认删除</AlertDialogTitle>
                              <AlertDialogDescription>
                                删除后无法恢复，确定要删除这条日报吗？
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(item.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                {deleteMutation.isPending ? '删除中...' : '删除'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="py-14">
                    <Empty>
                      <EmptyHeader>
                        <div className="mb-2 flex justify-center">
                          <Image
                            src={aiAvatarUrl}
                            alt="BSS 智能助手形象"
                            className="size-16 rounded-full object-cover shadow-sm ring-2 ring-primary/10"
                          />
                        </div>
                        <EmptyTitle>还没有日报记录</EmptyTitle>
                        <EmptyDescription>
                          点击右上角「新建日报」，开始记录今天的工作
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
          <span className="shrink-0 whitespace-nowrap text-sm text-slate-500">
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
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
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
                  className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default DailyReportPage;
