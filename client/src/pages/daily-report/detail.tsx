import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  AlertCircle,
  AlignLeft,
  ArrowLeft,
  ClipboardList,
  CopyPlus,
  FileText,
  Pencil,
  Settings2,
  Sparkles,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { UserDisplay } from '@/components/business-ui/user-display';
import { PageHeader } from '@/components/brand/PageHeader';
import { dailyReportApi } from '@/api';
import { getApiErrorMessage } from '@/lib/api-error';
import aiAvatarUrl from '@/assets/ai-assistant.png';
import { Image } from '@client/src/components/ui/image';

const STAGGER_CLASSES = [
  'stagger-1',
  'stagger-2',
  'stagger-3',
  'stagger-4',
] as const;

interface SectionCardProps {
  icon: LucideIcon;
  title: string;
  step: number;
  children: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({
  icon: Icon,
  title,
  step,
  children,
}) => (
  <Card
    className={`animate-fade-up ${
      STAGGER_CLASSES[Math.min(step - 1, STAGGER_CLASSES.length - 1)]
    }`}
  >
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
          <Icon className="size-4" />
        </span>
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const renderValue = (value?: string | number | null): React.ReactNode =>
  value || value === 0 ? (
    String(value)
  ) : (
    <span className="text-slate-400">-</span>
  );

const FieldRow = ({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) => (
  <div className="space-y-1 border-b border-slate-100 py-2.5 last:border-0">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="break-words text-sm text-slate-800">
      {renderValue(value)}
    </div>
  </div>
);

const SectionBlock = ({
  label,
  content,
}: {
  label: string;
  content?: string;
}) => (
  <div className="space-y-1.5">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="min-h-[64px] whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">
      {content || <span className="text-slate-400">-</span>}
    </div>
  </div>
);

const DailyReportDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDelete, setShowDelete] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ['daily-report', id],
    queryFn: () => dailyReportApi.getDailyReport(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => dailyReportApi.deleteDailyReport(id!),
    retry: false,
    onSuccess: () => {
      toast.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['daily-reports'] });
      navigate('/daily-report');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, '删除失败，请稍后重试'));
    },
  });

  if (isLoading) {
    return <div className="text-slate-500">加载中...</div>;
  }

  if (!report) {
    return <div className="text-slate-500">日报不存在</div>;
  }

  return (
    <div className="space-y-5">
      <div className="animate-fade-up">
        <PageHeader
          title="日报详情"
          description={`${report.reportDate} · ${report.department} · ${report.taskName}`}
          action={
            <>
              <Button variant="ghost" size="icon" asChild aria-label="返回">
                <Link to="/daily-report">
                  <ArrowLeft className="size-5" />
                </Link>
              </Button>
              {report.canEdit ? (
                <>
              {report.reportDate !==
              new Date().toISOString().split('T')[0] ? (
                <Button variant="outline" asChild>
                  <Link to={`/daily-report/new?from=${report.id}`}>
                    <CopyPlus className="size-4" />
                    以此为底稿写今日
                  </Link>
                </Button>
              ) : null}
              <Button variant="outline" asChild>
                <Link to={`/daily-report/${id}/edit`}>
                  <Pencil className="size-4" />
                  编辑
                </Link>
              </Button>
              <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="size-4" />
                    删除
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
                      onClick={() => deleteMutation.mutate()}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {deleteMutation.isPending ? '删除中...' : '删除'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
                </>
              ) : null}
            </>
          }
        />
      </div>

      <SectionCard icon={FileText} title="基本信息" step={1}>
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          <FieldRow label="填报日期" value={report.reportDate} />
          <FieldRow label="所属部门" value={report.department} />
          <div className="space-y-1 border-b border-slate-100 py-2.5">
            <div className="text-xs text-slate-500">填报人</div>
            <div className="text-sm text-slate-800">
              <UserDisplay value={[report.reporterId]} size="small" />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={ClipboardList} title="任务信息" step={2}>
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          <FieldRow
            label="任务来源"
            value={
              report.taskSources && report.taskSources.length > 0
                ? report.taskSources.join('、')
                : report.taskSource
            }
          />
          <FieldRow label="任务名称" value={report.taskName} />
        </div>
      </SectionCard>

      <SectionCard icon={AlignLeft} title="工作内容" step={3}>
        <div className="space-y-4">
          {report.completionRows && report.completionRows.length > 0 ? (
            <div className="space-y-3">
              {report.completionRows.map((row, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-slate-100 bg-slate-50/40 p-3"
                >
                  {((row.projectNames ?? []).length > 0 || row.task) && (
                    <div className="mb-1 space-y-0.5">
                      {(row.projectNames ?? []).length > 0 ? (
                        <p className="text-xs font-semibold text-slate-800">
                          {row.projectNames.join('、')}
                        </p>
                      ) : null}
                      {row.task ? (
                        <p className="whitespace-pre-wrap text-xs text-slate-600">
                          任务：{row.task}
                        </p>
                      ) : null}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {row.completion || '—'}
                  </p>
                  {typeof row.workHours === 'string' && row.workHours ? (
                    <p className="mt-1.5 text-xs text-slate-500">
                      工时：{row.workHours}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <SectionBlock
              label="当日完成情况"
              content={report.dayCompletion}
            />
          )}
        </div>
      </SectionCard>

      <SectionCard icon={Settings2} title="产出" step={4}>
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          <FieldRow label="输出文件数量" value={report.outputFileCount} />
        </div>
      </SectionCard>

      <SectionCard icon={AlertCircle} title="问题与协助" step={4}>
        <div className="space-y-4">
          <SectionBlock label="需协助事项" content={report.assistanceNeeded} />
        </div>
      </SectionCard>

      <Card className="animate-fade-up stagger-4 border-primary/15 bg-gradient-to-br from-primary/[0.06] via-white to-white">
        <CardContent className="flex items-start gap-3 p-4">
          <Image
            src={aiAvatarUrl}
            alt="BSS 智能助手形象"
            className="size-10 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm"
          />
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <Sparkles className="size-3.5 text-primary" />
              BSS 智能助手
            </p>
            <p className="text-xs leading-relaxed text-slate-500">
              日报提交后会自动纳入周报 / 月报汇总；如需修改数据，可点击右上角「编辑」补充。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyReportDetailPage;
