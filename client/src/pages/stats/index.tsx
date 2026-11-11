import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useDataScope } from '@/hooks/use-data-scope';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Users,
  Building2,
  SlidersHorizontal,
  Download,
  CalendarCheck2,
} from 'lucide-react';

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
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import EnergyHero from '@/components/brand/EnergyHero';
import AttendanceDayMark from '@/components/stats/AttendanceDayMark';
import { statsApi } from '@/api';
import aiAvatarUrl from '@/assets/ai-assistant.png';
import { DEPARTMENTS, type DepartmentStats } from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';
import { downloadFileByUrl } from '@/utils/download-file';
import { toast } from 'sonner';

const formatDate = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getDefaultRange = (): { start: string; end: string } => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { start: formatDate(start), end: formatDate(end) };
};

const getCurMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const STAGGER_CLASSES = ['', 'stagger-1', 'stagger-2', 'stagger-3'];

const ALL_DEPARTMENTS = 'all';

const StatsPage = () => {
  const { data: scope, isLoading: scopeLoading } = useDataScope();
  const defaultRange = getDefaultRange();
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [department, setDepartment] = useState(ALL_DEPARTMENTS);
  const [month, setMonth] = useState(getCurMonth());
  const [exporting, setExporting] = useState(false);

  const params = useMemo(() => {
    const p: { startDate: string; endDate: string; department?: string } = {
      startDate,
      endDate,
    };
    if (department !== ALL_DEPARTMENTS) p.department = department;
    return p;
  }, [startDate, endDate, department]);

  const { data: deptStats, isLoading: deptLoading } = useQuery({
    queryKey: ['stats-department', params],
    queryFn: () => statsApi.getDepartmentStats(params),
  });

  const { data: attendance, isLoading: attLoading } = useQuery({
    queryKey: ['stats-attendance', month],
    queryFn: () => statsApi.getAttendance(month),
  });
  const workingDays = attendance?.workingDays ?? [];

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await statsApi.exportAttendance(month);
      downloadFileByUrl(`${window.location.origin}${res.downloadUrl}`, res.fileName);
    } catch (error) {
      const msg =
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? '出勤核对文件导出失败，请稍后重试';
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  };

  const visibleDeptStats = useMemo(() => {
    if (!deptStats) return [];
    if (department === ALL_DEPARTMENTS) return deptStats;
    return deptStats.filter(
      (item: DepartmentStats) => item.department === department,
    );
  }, [deptStats, department]);

  const overview = useMemo(() => {
    if (visibleDeptStats.length === 0) {
      return {
        totalReports: 0,
        totalUsers: 0,
      };
    }
    const totalReports = visibleDeptStats.reduce(
      (sum: number, d: DepartmentStats) =>
        sum + (d.submittedUsers * (d.submissionRate / 100) || 0),
      0,
    );
    const totalUsers = visibleDeptStats.reduce(
      (sum: number, d: DepartmentStats) => sum + d.submittedUsers,
      0,
    );

    return {
      totalReports: Math.round(totalReports),
      totalUsers: Math.round(totalUsers),
    };
  }, [visibleDeptStats]);

  const statCards = [
    {
      label: '总提交人次',
      value: overview.totalReports,
      icon: BarChart3,
      suffix: '次',
    },
    {
      label: '提交人数',
      value: overview.totalUsers,
      icon: Users,
      suffix: '人',
    },
  ];

  if (scopeLoading) return <div className="text-slate-500">加载中...</div>;
  if (!scope?.features?.canViewStats) {
    return <Navigate to="/daily-report" replace />;
  }

  return (
    <div className="space-y-5">
      <EnergyHero
        title="统计看板"
        description="查看全员日报提交情况与部门工作量分布"
        action={
          <Button
            className="shadow-sm"
            onClick={() => {
              setDepartment(ALL_DEPARTMENTS);
              setStartDate(defaultRange.start);
              setEndDate(defaultRange.end);
            }}
          >
            重置
          </Button>
        }
      />

      <Card className="animate-fade-up stagger-1">
        <CardContent className="p-4 lg:p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
            <SlidersHorizontal className="size-4 text-primary" />
            筛选条件
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">开始日期</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">结束日期</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">部门</label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择部门" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_DEPARTMENTS}>全部（全公司）</SelectItem>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant={department === ALL_DEPARTMENTS ? 'default' : 'outline'}
                aria-pressed={department === ALL_DEPARTMENTS}
                onClick={() => setDepartment(ALL_DEPARTMENTS)}
              >
                全部
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDepartment(ALL_DEPARTMENTS);
                  setStartDate(defaultRange.start);
                  setEndDate(defaultRange.end);
                }}
              >
                重置
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card
              key={idx}
              className={`card-lift animate-fade-up ${STAGGER_CLASSES[idx] ?? ''} ${
                idx === 0 ? 'stat-sheen' : ''
              } relative overflow-hidden`}
            >
              <Icon className="pointer-events-none absolute -right-3 -top-3 size-20 text-primary/[0.06]" />
              <CardContent className="relative p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-slate-500">{stat.label}</p>
                    <p className="text-2xl font-bold text-primary tabular-nums">
                      {stat.value}
                      <span className="ml-1 text-sm font-normal text-slate-500">
                        {stat.suffix}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="size-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="animate-fade-up stagger-2 overflow-hidden">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            <h2 className="text-lg font-semibold text-slate-800">
              部门提交统计
            </h2>
          </div>
        </CardContent>
        <CardContent className="p-0 pt-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                <TableHead className="font-semibold text-slate-600">部门</TableHead>
                <TableHead className="w-28 font-semibold text-slate-600">提交人数</TableHead>
                <TableHead className="w-36 font-semibold text-slate-600">提交率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deptLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-16 text-center text-sm text-slate-500"
                  >
                    正在加载统计数据...
                  </TableCell>
                </TableRow>
              ) : visibleDeptStats.length > 0 ? (
                visibleDeptStats.map((item: DepartmentStats) => (
                  <TableRow
                    key={item.department}
                    className="transition-colors hover:bg-primary/[0.025]"
                  >
                    <TableCell>
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {item.department}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums text-slate-700">
                      {item.submittedUsers} 人
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={item.submissionRate}
                          className="h-1.5 flex-1"
                        />
                        <span className="w-11 text-right text-xs tabular-nums text-slate-500">
                          {item.submissionRate.toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="py-14">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <Image
                        src={aiAvatarUrl}
                        alt="暂无部门统计数据"
                        className="size-16 rounded-full object-cover ring-2 ring-primary/10"
                      />
                      <p className="text-sm text-slate-500">暂无部门统计数据</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="animate-fade-up stagger-2 overflow-hidden">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarCheck2 className="size-5 text-primary" />
              <h2 className="text-lg font-semibold text-slate-800">
                月度出勤核对（全公司 · 按人员 × 工作日）
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="month"
                value={month}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
                className="w-40"
              />
              <Button
                variant="outline"
                disabled={exporting}
                onClick={handleExport}
              >
                <Download className="size-4" />
                {exporting ? '生成中...' : '下载核对表'}
              </Button>
            </div>
          </div>
        </CardContent>
        <CardContent className="p-0 pt-0">
          <div className="overflow-x-auto">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                  <TableHead className="font-semibold text-slate-600">
                    员工
                  </TableHead>
                  <TableHead className="w-24 font-semibold text-slate-600">
                    提交天数
                  </TableHead>
                  <TableHead className="w-24 font-semibold text-slate-600">
                    缺交天数
                  </TableHead>
                  <TableHead className="w-20 font-semibold text-slate-600">
                    补交
                  </TableHead>
                  {workingDays.map((d) => (
                    <TableHead
                      key={d}
                      className="min-w-12 px-1 text-center font-semibold text-slate-600"
                    >
                      {d.slice(5)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {attLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={workingDays.length + 4}
                      className="py-16 text-center text-sm text-slate-500"
                    >
                      正在加载出勤数据...
                    </TableCell>
                  </TableRow>
                ) : attendance && attendance.employees.length > 0 ? (
                  attendance.employees.map((emp) => (
                    <TableRow
                      key={emp.userId}
                      className="transition-colors hover:bg-primary/[0.025]"
                    >
                      <TableCell className="font-medium text-slate-700">
                        {emp.name}
                      </TableCell>
                      <TableCell className="tabular-nums text-emerald-700">
                        {emp.submittedDays}
                      </TableCell>
                      <TableCell
                        className={`tabular-nums ${
                          emp.missingDays > 0 ? 'font-semibold text-rose-600' : 'text-slate-500'
                        }`}
                      >
                        {emp.missingDays}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {emp.supplementCount > 0 ? (
                          <span className="font-medium text-amber-600">
                            {emp.supplementCount}
                          </span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </TableCell>
                      {workingDays.map((d) => (
                        <TableCell key={d} className="px-1 text-center">
                          <AttendanceDayMark
                            cell={emp.days[d]}
                            supplementDates={emp.supplementOn?.[d]}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={workingDays.length + 4}
                      className="py-14 text-center text-sm text-slate-500"
                    >
                      暂无该月的出勤核对数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-2 px-5 pb-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="text-emerald-600">✓</span>当日提交
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="font-semibold text-amber-600">✓</span>
                <span className="rounded bg-amber-100 px-1 text-[9px] font-medium text-amber-700">
                  补
                </span>
                补交（悬停看提交日期）
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
                  n
                </span>
                该日补交了往日 n 份日报
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="text-rose-600">✗</span>未提交
              </span>
            </div>
            <p className="text-xs text-slate-400">
              补交判定：日报的填报日期早于实际提交日期（如 10 号早上交 9 号的日报），仍计入 9 号；当月补交共 {attendance?.supplementTotal ?? 0} 条。工作日口径：周一至周五（不含周末），法定节假日暂按工作日统计；人员名单＝曾提交过日报的员工。核对表展示与下载均为全公司全员，不受上方部门筛选影响。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsPage;
