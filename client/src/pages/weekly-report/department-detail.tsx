import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Image } from '@/components/ui/image';
import DepartmentReportDocument from '@/components/department-report/DepartmentReportDocument';
import WeeklyReportTemplate from '@/components/report-template/WeeklyReportTemplate';
import { ExportDocumentButton } from '@/components/report/ExportDocumentButton';
import { ReportHeader } from '@/components/report';
import * as departmentReportApi from '@/api/department-report';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDateTime, formatWeekLabel } from '@/lib/period';
import aiAvatarUrl from '@/assets/ai-assistant.png';
import type {
  DepartmentWeeklyReportDetail,
  WeeklyTemplateData,
} from '@shared/api.interface';

const DepartmentWeeklyReportDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useQuery<DepartmentWeeklyReportDetail>({
    queryKey: ['department-weekly-report', id],
    queryFn: () => departmentReportApi.getDepartmentWeeklyReport(id ?? ''),
    enabled: Boolean(id),
  });

  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draftData, setDraftData] = useState<WeeklyTemplateData | null>(null);

  const saveMutation = useMutation({
    mutationFn: (templateData: WeeklyTemplateData) =>
      departmentReportApi.updateDepartmentWeeklyTemplate(id ?? '', templateData),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-weekly-report', id] });
      toast.success('部门周报模板已保存');
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="outline" size="sm" asChild>
          <Link to="/weekly-report?tab=department">
            <ArrowLeft className="size-4" />
            返回部门周报列表
          </Link>
        </Button>
        {data ? (
          <>
            <ExportDocumentButton
              reportType="department-weekly"
              reportId={data.id}
              size="sm"
            />
            {data.templateData && editing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
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
                  size="sm"
                  onClick={() => draftData && saveMutation.mutate(draftData)}
                  disabled={saveMutation.isPending}
                >
                  <Save className="size-4" />
                  保存模板
                </Button>
              </>
            ) : data.templateData ? (
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Pencil className="size-4" />
                编辑模板
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-rose-600">
            {departmentReportApi.describeDepartmentReportError(
              error,
              '加载部门周报失败，请稍后重试',
            )}
          </CardContent>
        </Card>
      ) : data && data.templateData ? (
        <div className="space-y-5">
          <ReportHeader
            title={`${data.department} · 部门周报`}
            subtitle={formatWeekLabel(data.weekStart, data.weekEnd)}
            meta={`生成时间 ${formatDateTime(data.createdAt)}`}
            stats={[
              { label: '日报数量', value: data.reportCount, suffix: '篇' },
              { label: '卡点数', value: data.issueCount, suffix: '项' },
            ]}
          />
          <WeeklyReportTemplate
            templateData={editing && draftData ? draftData : data?.templateData}
            editable={editing}
            onDataChange={setDraftData}
          />
        </div>
      ) : data ? (
        <DepartmentReportDocument
          title={`${data.department} · 部门周报`}
          subtitle={formatWeekLabel(data.weekStart, data.weekEnd)}
          meta={`生成时间 ${formatDateTime(data.createdAt)}`}
          reportCount={data.reportCount}
          issueCount={data.issueCount}
          summaryContent={data.summaryContent}
          issuesSummary={data.issuesSummary}
          taskSourceGroups={data.taskSourceGroups}
          issueReports={data.issueReports}
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Image
              src={aiAvatarUrl}
              alt="BSS 智能助手形象"
              className="size-16 rounded-full object-cover shadow-sm ring-2 ring-primary/10"
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">部门周报不存在</p>
              <p className="text-xs text-slate-500">
                该报告可能已被删除，请返回列表重新选择
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DepartmentWeeklyReportDetailPage;
