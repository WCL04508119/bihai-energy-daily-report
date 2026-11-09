import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  Eye,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { PageHeader } from '@/components/brand/PageHeader';
import { Image } from '@/components/ui/image';
import * as departmentReportApi from '@/api/department-report';
import {
  formatDateTime,
  formatMonthLabel,
  formatWeekLabel,
  getCurrentMonthIso,
  getWeekStartIso,
  type ReportPeriodType,
} from '@/lib/period';
import {
  DEPARTMENTS,
  type Department,
  type DepartmentMonthlyReport,
  type DepartmentWeeklyReport,
} from '@shared/api.interface';
import aiAvatarUrl from '@/assets/ai-assistant.png';
import GenerateDepartmentReportDialog from './GenerateDepartmentReportDialog';

interface DepartmentReportPanelProps {
  periodType: ReportPeriodType;
}

interface DepartmentReportRow {
  id: string;
  department: Department;
  periodLabel: string;
  reportCount: number;
  issueCount: number;
  createdAt: string;
}

interface DepartmentReportListResult {
  items: DepartmentReportRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 10;

const fetchWeeklyPage = async (params: {
  page: number;
  pageSize: number;
  department?: string;
  weekStart?: string;
}): Promise<DepartmentReportListResult> => {
  const response = await departmentReportApi.getDepartmentWeeklyReports({
    page: params.page,
    pageSize: params.pageSize,
    department: params.department,
    weekStart: params.weekStart,
  });
  return {
    items: response.items.map((item: DepartmentWeeklyReport) => ({
      id: item.id,
      department: item.department,
      periodLabel: formatWeekLabel(item.weekStart, item.weekEnd),
      reportCount: item.reportCount,
      issueCount: item.issueCount,
      createdAt: item.createdAt,
    })),
    total: response.total,
    page: response.page,
    pageSize: response.pageSize,
  };
};

const fetchMonthlyPage = async (params: {
  page: number;
  pageSize: number;
  department?: string;
  reportMonth?: string;
}): Promise<DepartmentReportListResult> => {
  const response = await departmentReportApi.getDepartmentMonthlyReports({
    page: params.page,
    pageSize: params.pageSize,
    department: params.department,
    reportMonth: params.reportMonth,
  });
  return {
    items: response.items.map((item: DepartmentMonthlyReport) => ({
      id: item.id,
      department: item.department,
      periodLabel: formatMonthLabel(item.reportMonth),
      reportCount: item.reportCount,
      issueCount: item.issueCount,
      createdAt: item.createdAt,
    })),
    total: response.total,
    page: response.page,
    pageSize: response.pageSize,
  };
};

const DepartmentReportPanel: React.FC<DepartmentReportPanelProps> = ({
  periodType,
}) => {
  const queryClient = useQueryClient();
  const isWeekly: boolean = periodType === 'weekly';
  const [department, setDepartment] = useState<string>('all');
  const [periodValue, setPeriodValue] = useState<string>(
    isWeekly ? getWeekStartIso() : getCurrentMonthIso(),
  );
  const [page, setPage] = useState<number>(1);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<DepartmentReportRow | null>(
    null,
  );

  const departmentParam: string | undefined =
    department === 'all' ? undefined : department;

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      'department-reports',
      periodType,
      page,
      departmentParam ?? 'all',
      periodValue,
    ],
    queryFn: (): Promise<DepartmentReportListResult> =>
      isWeekly
        ? fetchWeeklyPage({
            page,
            pageSize: PAGE_SIZE,
            department: departmentParam,
            weekStart: periodValue || undefined,
          })
        : fetchMonthlyPage({
            page,
            pageSize: PAGE_SIZE,
            department: departmentParam,
            reportMonth: periodValue || undefined,
          }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string): Promise<{ success: boolean }> =>
      isWeekly
        ? departmentReportApi.deleteDepartmentWeeklyReport(id)
        : departmentReportApi.deleteDepartmentMonthlyReport(id),
    retry: false,
    onSuccess: () => {
      toast.success('部门报告已删除');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['department-reports'] });
    },
    onError: (error: unknown) => {
      toast.error(
        departmentReportApi.describeDepartmentReportError(
          error,
          '删除失败，请稍后重试',
        ),
      );
      setDeleteTarget(null);
    },
  });

  const totalPages: number = data ? Math.ceil(data.total / data.pageSize) : 0;
  const detailPath = (id: string): string =>
    isWeekly
      ? `/weekly-report/department/${id}`
      : `/monthly-report/department/${id}`;

  const handleCreated = (created: {
    department: Department;
    periodValue: string;
  }): void => {
    setDepartment(created.department);
    setPeriodValue(created.periodValue);
    setPage(1);
    queryClient.invalidateQueries({ queryKey: ['department-reports'] });
  };

  return (
    <div className="space-y-5">
      <div className="animate-fade-up">
        <PageHeader
          title={isWeekly ? '部门周报' : '部门月报'}
          description={
            isWeekly
              ? '室主任根据本部门员工周报生成部门级周报'
              : '室主任根据本部门员工月报生成部门级月报'
          }
          action={
            <Button
              onClick={() => setDialogOpen(true)}
              className="shadow-sm"
            >
              <Sparkles className="size-4" />
              {isWeekly ? '生成部门周报' : '生成部门月报'}
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <label
                htmlFor="department-report-filter-period"
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500"
              >
                <CalendarDays className="size-3.5" aria-hidden />
                {isWeekly ? '周起始日' : '月份'}
              </label>
              <Input
                id="department-report-filter-period"
                type={isWeekly ? 'date' : 'month'}
                value={periodValue}
                onChange={(event) => {
                  setPeriodValue(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="department-report-filter-department"
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500"
              >
                <Building2 className="size-3.5" aria-hidden />
                部门
              </label>
              <Select
                value={department}
                onValueChange={(value: string) => {
                  setDepartment(value);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  id="department-report-filter-department"
                  className="w-full"
                >
                  <SelectValue placeholder="全部部门" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部部门</SelectItem>
                  {DEPARTMENTS.map((item: Department) => (
                    <SelectItem key={item} value={item}>
                      {item}
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
                <TableHead className="font-semibold text-slate-600">部门</TableHead>
                <TableHead className="font-semibold text-slate-600">周期</TableHead>
                <TableHead className="w-24 font-semibold text-slate-600">
                  日报数量
                </TableHead>
                <TableHead className="w-24 font-semibold text-slate-600">卡点数</TableHead>
                <TableHead className="w-40 font-semibold text-slate-600">
                  生成时间
                </TableHead>
                <TableHead className="w-24 text-right font-semibold text-slate-600">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-16 text-center text-sm text-slate-500"
                  >
                    正在加载部门报告...
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-16 text-center text-sm text-rose-600">
                    部门报告加载失败，请稍后重试
                  </TableCell>
                </TableRow>
              ) : data && data.items.length > 0 ? (
                data.items.map((item: DepartmentReportRow) => (
                  <TableRow
                    key={item.id}
                    className="transition-colors hover:bg-primary/[0.025]"
                  >
                    <TableCell>
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {item.department}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-slate-700">
                      {item.periodLabel}
                    </TableCell>
                    <TableCell className="tabular-nums text-slate-700">
                      {item.reportCount}
                    </TableCell>
                    <TableCell>
                      {item.issueCount > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-rose-200 bg-rose-50 text-rose-700"
                        >
                          {item.issueCount} 项
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-slate-200 bg-slate-100 text-slate-600"
                        >
                          无
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-xs text-slate-500">
                      {formatDateTime(item.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="text-slate-500 hover:bg-primary/10 hover:text-primary"
                        >
                          <Link
                            to={detailPath(item.id)}
                            aria-label={`查看 ${item.department} ${item.periodLabel} 部门报告`}
                          >
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`删除 ${item.department} ${item.periodLabel} 部门报告`}
                          className="text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-14">
                    <Empty>
                      <EmptyHeader>
                        <div className="mb-2 flex justify-center">
                          <Image
                            src={aiAvatarUrl}
                            alt="BSS 智能助手形象"
                            className="size-16 rounded-full object-cover shadow-sm ring-2 ring-primary/10"
                          />
                        </div>
                        <EmptyTitle>暂无部门报告</EmptyTitle>
                        <EmptyDescription>
                          点击右上角「{isWeekly ? '生成部门周报' : '生成部门月报'}」，由数智员工汇总本部门日报生成
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
                  onClick={() => setPage(Math.max(1, page - 1))}
                  aria-disabled={page <= 1}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_: unknown, i: number) => i + 1)
                .filter(
                  (p: number) =>
                    p === 1 || p === totalPages || Math.abs(p - page) <= 1,
                )
                .map((p: number, idx: number, arr: number[]) => (
                  <div key={p} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <PaginationItem>
                        <span className="px-2 text-slate-400">...</span>
                      </PaginationItem>
                    )}
                    <PaginationItem>
                      <PaginationLink isActive={p === page} onClick={() => setPage(p)}>
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  </div>
                ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
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

      <GenerateDepartmentReportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        periodType={periodType}
        onCreated={handleCreated}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除这份部门报告？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.department} · ${deleteTarget.periodLabel} 的部门报告将被删除，删除后不可恢复。`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DepartmentReportPanel;
