import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Markdown } from '@/components/ui/markdown';
import {
  ReportHeader,
  IssueSection,
  TaskSourceGroupSection,
} from '@/components/report';
import WeeklyReportTemplate from '@/components/report-template/WeeklyReportTemplate';
import { ExportDocumentButton } from '@/components/report/ExportDocumentButton';
import { weeklyReportApi } from '@/api';
import { getIssueReports, groupByTaskSource } from '@/utils/report-group';
import { getApiErrorMessage } from '@/lib/api-error';
import aiAvatarUrl from '@/assets/ai-assistant.png';
import { Image } from '@client/src/components/ui/image';
import type { DailyReport, TaskSourceGroup, WeeklyTemplateData } from '@shared/api.interface';

const getWeekNumber = (dateStr: string): number => {
  const date = new Date(dateStr);
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.ceil((diff + (start.getDay() + 1) * 24 * 60 * 60 * 1000) / oneWeek);
};

const WeeklyReportDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['weekly-report', id],
    queryFn: () => weeklyReportApi.getWeeklyReport(id || ''),
    enabled: !!id,
  });

  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draftData, setDraftData] = useState<WeeklyTemplateData | null>(null);

  const saveMutation = useMutation({
    mutationFn: (templateData: WeeklyTemplateData) =>
      weeklyReportApi.updateWeeklyTemplate(id || '', templateData),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-report', id] });
      toast.success('周报模板已保存');
      setEditing(false);
      setDraftData(null);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, '保存失败，请稍后重试'));
    },
  });

  const startEdit = () => {
    if (!data?.templateData) return;
    setDraftData(data.templateData);
    setEditing(true);
  };

  const weekYear = data ? new Date(data.weekStart).getFullYear() : 0;
  const weekNum = data ? getWeekNumber(data.weekStart) : 0;

  const dailyReports: DailyReport[] = data?.dailyReports ?? [];
  const issueReports: DailyReport[] = getIssueReports(dailyReports);
  const groups: TaskSourceGroup[] = groupByTaskSource(dailyReports);

  return (
    <div className="space-y-5">
      <div className="animate-fade-up flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
          返回列表
        </Button>
        {data ? (
          <>
            <ExportDocumentButton reportType="weekly" reportId={data.id} />
            {data.templateData && editing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setDraftData(null);
                  }}
                >
                  <X className="size-4" />
                  取消
                </Button>
                <Button
                  variant="outline"
                  onClick={() => draftData && saveMutation.mutate(draftData)}
                  disabled={saveMutation.isPending}
                >
                  <Save className="size-4" />
                  保存模板
                </Button>
              </>
            ) : data.templateData ? (
              <Button variant="outline" onClick={startEdit}>
                <Pencil className="size-4" />
                编辑模板
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-500">加载中...</div>
      ) : data ? (
        <>
          <ReportHeader
            title={`${weekYear}年第${weekNum}周周报`}
            subtitle={`${data.department} · ${data.weekStart} 至 ${data.weekEnd}`}
            stats={[
              { label: '日报数量', value: data.reportCount, suffix: '篇' },
              { label: '卡点数量', value: issueReports.length, suffix: '项' },
            ]}
          />

          {data.templateData ? (
            <WeeklyReportTemplate
              templateData={editing && draftData ? draftData : data.templateData}
              editable={editing}
              onDataChange={setDraftData}
              className="animate-fade-up stagger-2"
            />
          ) : (
            <>
              <Card className="animate-fade-up stagger-2">
                <CardContent className="p-4">
                  <p className="text-sm text-slate-500">
                    该周报生成于模板升级前，暂未包含完整模板内容
                  </p>
                </CardContent>
              </Card>

              <section className="animate-fade-up stagger-2 space-y-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-4 border-l-rose-500 pl-3">
                  <h2 className="text-lg font-semibold text-slate-800">卡点与问题</h2>
                  <span className="text-xs text-rose-600">
                    共 {issueReports.length} 项 · 偏差原因与所需支持集中在此
                  </span>
                </div>
                <IssueSection reports={issueReports} />
              </section>

              {data.summaryContent ? (
                <Card className="animate-fade-up stagger-3">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-4 border-l-primary pl-3">
                      <h2 className="text-lg font-semibold text-slate-800">
                        工作总结
                      </h2>
                    </div>
                    <Markdown className="text-sm leading-relaxed text-slate-700">
                      {data.summaryContent}
                    </Markdown>
                  </CardContent>
                </Card>
              ) : null}

              <section className="animate-fade-up stagger-3 space-y-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-4 border-l-primary pl-3">
                  <h2 className="text-lg font-semibold text-slate-800">
                    按任务来源分组明细
                  </h2>
                  <span className="text-xs text-slate-500">
                    共 {dailyReports.length} 条记录 · {groups.length} 个任务来源
                  </span>
                </div>
                {groups.length > 0 ? (
                  <div className="space-y-4">
                    {groups.map((group: TaskSourceGroup) => (
                      <TaskSourceGroupSection key={group.taskSource} group={group} />
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                      <Image
                        src={aiAvatarUrl}
                        alt="BSS 智能助手形象"
                        className="size-16 rounded-full object-cover shadow-sm ring-2 ring-primary/10"
                      />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-800">
                          本周还没有日报明细
                        </p>
                        <p className="text-xs text-slate-500">
                          员工提交日报后会自动汇总到本周周报中
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </section>
            </>
          )}
        </>
      ) : (
        <Card className="animate-fade-up">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Image
              src={aiAvatarUrl}
              alt="BSS 智能助手形象"
              className="size-16 rounded-full object-cover shadow-sm ring-2 ring-primary/10"
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">周报不存在</p>
              <p className="text-xs text-slate-500">
                该周报可能已被删除，请返回列表重新选择
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WeeklyReportDetailPage;
