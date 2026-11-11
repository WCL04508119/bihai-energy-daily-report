import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarRange,
  FolderKanban,
  RotateCcw,
  TriangleAlert,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
import { UserDisplay } from '@/components/business-ui/user-display';
import EnergyHero from '@/components/brand/EnergyHero';
import AiAnalysisPanel from '@/components/manager-dashboard/AiAnalysisPanel';
import { useDataScope } from '@/hooks/use-data-scope';
import { managerDashboardApi } from '@/api';
import {
  DEPARTMENTS,
  MANAGER_PERIOD_LABELS,
  MANAGER_PERIODS,
  type ManagerDashboardResponse,
  type ManagerMetric,
  type ManagerPeriod,
} from '@shared/api.interface';

const DAY_MS = 24 * 60 * 60 * 1000;
const ALL_DEPARTMENTS = 'all';

const pad = (value: number): string => String(value).padStart(2, '0');

const formatDay = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const today = (): string => formatDay(new Date());

const shiftDay = (day: string, offset: number): string =>
  new Date(new Date(`${day}T00:00:00Z`).getTime() + offset * DAY_MS)
    .toISOString()
    .slice(0, 10);

const shiftAnchor = (
  anchor: string,
  period: ManagerPeriod,
  direction: 1 | -1,
): string => {
  if (period === 'day') return shiftDay(anchor, direction);
  if (period === 'week') return shiftDay(anchor, direction * 7);
  const [year, month] = anchor.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + direction, 1));
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-01`;
};

const dimensionTotal = (items: ManagerMetric[]): number =>
  items.reduce((sum: number, item: ManagerMetric) => sum + item.count, 0);

const MetricList = ({
  items,
  emptyText,
}: {
  items: ManagerMetric[];
  emptyText: string;
}) => {
  const total: number = dimensionTotal(items);
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">{emptyText}</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((item: ManagerMetric) => (
        <div key={item.name} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
              {item.name}
            </span>
            <span className="shrink-0 text-xs text-slate-500">
              {item.count} 条 · {item.peopleCount} 人
            </span>
          </div>
          <Progress
            value={total > 0 ? Math.round((item.count / total) * 100) : 0}
            className="h-1.5"
          />
        </div>
      ))}
    </div>
  );
};

const ManagerDashboardPage = () => {
  const { data: scope, isLoading: scopeLoading } = useDataScope();
  const [period, setPeriod] = useState<ManagerPeriod>('week');
  const [anchor, setAnchor] = useState<string>(today());
  const [department, setDepartment] = useState<string>(ALL_DEPARTMENTS);

  const params = useMemo(() => {
    const query: {
      period: ManagerPeriod;
      anchor: string;
      department?: string;
    } = { period, anchor };
    if (department !== ALL_DEPARTMENTS) query.department = department;
    return query;
  }, [period, anchor, department]);

  const { data, isLoading, error } = useQuery<ManagerDashboardResponse>({
    queryKey: ['manager-dashboard', params],
    queryFn: () => managerDashboardApi.getManagerSummary(params),
    enabled: scope?.features?.canViewManagerDashboard === true,
    retry: false,
  });

  if (scopeLoading) {
    return <div className="text-slate-500">加载中...</div>;
  }
  if (!scope?.features?.canViewManagerDashboard) {
    return <Navigate to="/daily-report" replace />;
  }

  const canPickDepartment: boolean = scope.kind === 'all';
  const totals = data?.totals;
  const maxPersonReports: number = Math.max(
    1,
    ...(data?.byPerson ?? []).map((row) => row.reportCount),
  );

  const scopeLabel: string =
    scope.kind === 'department' && scope.departments.length > 0
      ? scope.departments.join('、')
      : '全公司';

  const statCards = [
    {
      label: '日报条数',
      value: totals?.reportCount ?? 0,
      suffix: '条',
      icon: CalendarRange,
    },
    {
      label: '参与人数',
      value: totals?.peopleCount ?? 0,
      suffix: '人',
      icon: Users,
    },
    {
      label: '覆盖部门',
      value: totals?.departmentCount ?? 0,
      suffix: '个',
      icon: Building2,
    },
    {
      label: '涉及项目',
      value: totals?.projectCount ?? 0,
      suffix: '个',
      icon: FolderKanban,
    },
    {
      label: '卡点条数',
      value: totals?.issueCount ?? 0,
      suffix: '条',
      icon: TriangleAlert,
    },
  ];

  return (
    <div className="space-y-5">
      <EnergyHero
        title="管理者看板"
        description={`按部门、人员和任务来源自动汇总 ${scopeLabel} 的日报工作量`}
        action={
          <Button
            variant="outline"
            className="shadow-sm"
            onClick={() => {
              setAnchor(today());
              setPeriod('week');
              setDepartment(ALL_DEPARTMENTS);
            }}
          >
            <RotateCcw className="mr-1.5 size-4" />
            回到本周
          </Button>
        }
      />

      <Card className="card-lift">
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <ToggleGroup
              type="single"
              value={period}
              onValueChange={(value: string) => {
                if (!value) return;
                setPeriod(value as ManagerPeriod);
              }}
              className="rounded-lg bg-slate-100 p-1"
            >
              {MANAGER_PERIODS.map((item: ManagerPeriod) => (
                <ToggleGroupItem
                  key={item}
                  value={item}
                  aria-label={`按${MANAGER_PERIOD_LABELS[item]}查看`}
                  className="px-3 text-sm data-[state=on]:bg-white data-[state=on]:text-primary"
                >
                  按{MANAGER_PERIOD_LABELS[item]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                aria-label="上一周期"
                onClick={() => setAnchor(shiftAnchor(anchor, period, -1))}
              >
                <ArrowLeft className="size-4" />
              </Button>
              <span className="min-w-[168px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-sm font-medium text-slate-700">
                {data?.rangeLabel ?? anchor}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="下一周期"
                onClick={() => setAnchor(shiftAnchor(anchor, period, 1))}
              >
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>

          {canPickDepartment ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">部门</span>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="选择部门" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_DEPARTMENTS}>全部部门</SelectItem>
                  {DEPARTMENTS.map((item: string) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Badge variant="outline" className="h-8 border-primary/20 bg-primary/5 px-3 text-primary">
              数据范围：{scopeLabel}
            </Badge>
          )}
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-rose-600">
            汇总数据加载失败，请稍后重试。
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-ai-section-type="card-stat">
        {statCards.map((card, index: number) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.label}
              className={`card-lift animate-fade-up ${['', 'stagger-1', 'stagger-2', 'stagger-3', 'stagger-4'][index] ?? ''}`}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{card.label}</p>
                  {isLoading ? (
                    <Skeleton className="mt-1 h-6 w-14" />
                  ) : (
                    <p className="text-xl font-bold text-slate-900">
                      {card.value}
                      <span className="ml-1 text-xs font-normal text-slate-500">
                        {card.suffix}
                      </span>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="card-lift">
          <CardContent className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">
                按任务来源
              </h2>
              <span className="text-xs text-slate-500">
                共 {dimensionTotal(data?.byTaskSource ?? [])} 条明细
              </span>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((key: number) => (
                  <Skeleton key={key} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <MetricList
                items={data?.byTaskSource ?? []}
                emptyText="本期暂无日报数据"
              />
            )}
          </CardContent>
        </Card>

        <Card className="card-lift">
          <CardContent className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">
                按项目
              </h2>
              <span className="text-xs text-slate-500">
                共 {(data?.byProject ?? []).length} 个项目
              </span>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((key: number) => (
                  <Skeleton key={key} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <MetricList
                items={data?.byProject ?? []}
                emptyText="本期暂无项目类日报"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <AiAnalysisPanel
        params={params}
        hasData={(data?.totals.reportCount ?? 0) > 0}
      />

      <Card className="card-lift">
        <CardContent className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">
              部门汇总
            </h2>
            <Link
              to="/weekly-report"
              className="text-xs font-medium text-primary hover:underline"
            >
              去编辑部门周报
            </Link>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>部门</TableHead>
                  <TableHead className="text-right">日报条数</TableHead>
                  <TableHead className="text-right">参与人数</TableHead>
                  <TableHead className="text-right">项目数</TableHead>
                  <TableHead className="text-right">卡点</TableHead>
                  <TableHead>主要任务来源</TableHead>
                  <TableHead>重点项目</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-24 w-full" />
                    </TableCell>
                  </TableRow>
                ) : (data?.byDepartment ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-sm text-slate-400"
                    >
                      本期无日报数据
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.byDepartment ?? []).map((row) => (
                    <TableRow key={row.department}>
                      <TableCell className="font-medium text-slate-800">
                        {row.department}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.reportCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.peopleCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.projectCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.issueCount > 0 ? (
                          <span className="font-medium text-rose-600">
                            {row.issueCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {row.taskSources
                          .map((item: ManagerMetric) => `${item.name}(${item.count})`)
                          .join('、') || '—'}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-slate-600">
                        {row.topProjects
                          .map((item: ManagerMetric) => item.name)
                          .join('、') || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="card-lift">
        <CardContent className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">
              人员汇总
            </h2>
            <span className="text-xs text-slate-500">
              共 {(data?.byPerson ?? []).length} 人
            </span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>成员</TableHead>
                  <TableHead>部门</TableHead>
                  <TableHead className="w-[160px]">日报量</TableHead>
                  <TableHead className="text-right">活跃天数</TableHead>
                  <TableHead className="text-right">项目数</TableHead>
                  <TableHead className="text-right">卡点</TableHead>
                  <TableHead>任务来源</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-24 w-full" />
                    </TableCell>
                  </TableRow>
                ) : (data?.byPerson ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-sm text-slate-400"
                    >
                      本期无成员日报
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.byPerson ?? []).map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell>
                        <UserDisplay userId={row.userId} size="small" />
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {row.department}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.round(
                              (row.reportCount / maxPersonReports) * 100,
                            )}
                            className="h-1.5 w-20"
                          />
                          <span className="tabular-nums text-sm text-slate-700">
                            {row.reportCount}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.activeDays}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.projectCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.issueCount > 0 ? (
                          <span className="font-medium text-rose-600">
                            {row.issueCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {row.taskSources
                          .map((item: ManagerMetric) => `${item.name}(${item.count})`)
                          .join('、') || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerDashboardPage;
