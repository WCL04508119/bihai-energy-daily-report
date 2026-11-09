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
import MonthlyReportTemplate from '@/components/report-template/MonthlyReportTemplate';
import { ExportDocumentButton } from '@/components/report/ExportDocumentButton';
import { monthlyReportApi, dailyReportApi } from '@/api';
import { getIssueReports, groupByTaskSource } from '@/utils/report-group';
import { getApiErrorMessage } from '@/lib/api-error';
import aiAvatarUrl from '@/assets/ai-assistant.png';
import { Image } from '@client/src/components/ui/image';
import type {
  DailyReport,
  DailyReportListResponse,
  MonthlyTemplateData,
  TaskSourceGroup,
} from '@shared/api.interface';

const PAGE_SIZE = 100;

const formatMonthLabel = (month: string): string => {
  const [year, m] = month.split('-');
  return `${year}年${Number(m)}月`;
};

const buildMonthRange = (
  reportMonth: string,
): { startDate: string; endDate: string } => {
  const [yearPart, monthPart] = reportMonth.split('-');
  const lastDay = new Date(Number(yearPart), Number(monthPart), 0).getDate();
  return {
    startDate: `${yearPart}-${monthPart}-01`,
    endDate: `${yearPart}-${monthPart}-${String(lastDay).padStart(2, '0')}`,
  };
};

const fetchMonthDailyReports = async (
  reporterId: string,
  startDate: string,
  endDate: string,
): Promise<DailyReport[]> => {
  const first: DailyReportListResponse = await dailyReportApi.getDailyReports({
    reporterId,
    startDate,
    endDate,
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const items: DailyReport[] = [...first.items];
  const totalPages = Math.ceil(first.total / PAGE_SIZE);
  if (totalPages > 1) {
    const restPages: DailyReportListResponse[] = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_: unknown, index: number) =>
        dailyReportApi.getDailyReports({
          reporterId,
          startDate,
          endDate,
          page: index + 2,
          pageSize: PAGE_SIZE,
        }),
      ),
    );
    restPages.forEach((res: DailyReportListResponse) => {
      items.push(...res.items);
    });
  }
  return items;
};

const MonthlyReportDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading: isDetailLoading } = useQuery({
    queryKey: ['monthly-report', id],
    queryFn: () => monthlyReportApi.getMonthlyReport(id || ''),
    enabled: !!id,
  });

  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draftData, setDraftData] = useState<MonthlyTemplateData | null>(null);

  const saveMutation = useMutation({
    mutationFn: (templateData: MonthlyTemplateData) =>
      monthlyReportApi.updateMonthlyTemplate(id || '', templateData),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-report', id] });
      toast.success('月报模板已保存');
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

  const monthRange = data?.reportMonth ? buildMonthRange(data.reportMonth) : null;

  const { data: dailyReportsData, isLoading: isReportsLoading } = useQuery({
    queryKey: ['monthly-report-daily', data?.reporterId, monthRange?.startDate],
    queryFn: () =>
      fetchMonthDailyReports(
        data?.reporterId ?? '',
        monthRange?.startDate ?? '',
        monthRange?.endDate ?? '',
      ),
    enabled: !!data?.reporterId && !!monthRange,
  });

  const dailyReports: DailyReport[] = dailyReportsData ?? [];
  const issueReports: DailyReport[] = getIssueReports(dailyReports);
  const groups: TaskSourceGroup[] = groupByTaskSource(dailyReports);
  const isLoading: boolean = isDetailLoading || isReportsLoading;

  return (
    <div className="space-y-5">
      <div className="animate-fade-up flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
          返回列表
        </Button>
        {data ? (
          <>
            <ExportDocumentButton reportType="monthly" reportId={data.id} />
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
            title={`${formatMonthLabel(data.reportMonth)}月报`}
            subtitle={`${data.department} · ${formatMonthLabel(data.reportMonth)}`}
            meta={
              monthRange
                ? `统计周期 ${monthRange.startDate} 至 ${monthRange.endDate}`
                : undefined
            }
            stats={[
              {
                label: '日报数量',
                value:
                  dailyReports.length > 0 ? dailyReports.length : data.reportCount,
                suffix: '篇',
              },
              { label: '卡点数量', value: issueReports.length, suffix: '项' },
            ]}
          />

          {data.templateData ? (
            <MonthlyReportTemplate
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
                    该月报生成于模板升级前，暂未包含完整模板内容
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
                          本月还没有日报明细
                        </p>
                        <p className="text-xs text-slate-500">
                          员工提交日报后会自动汇总到本月月报中
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
              <p className="text-sm font-semibold text-slate-800">月报不存在</p>
              <p className="text-xs text-slate-500">
                该月报可能已被删除，请返回列表重新选择
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MonthlyReportDetailPage;
