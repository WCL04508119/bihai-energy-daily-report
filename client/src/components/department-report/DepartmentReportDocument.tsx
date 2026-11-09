import React from 'react';
import { FileText } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Markdown } from '@/components/ui/markdown';
import { Image } from '@/components/ui/image';
import { IssueSection, ReportHeader, TaskSourceGroupSection } from '@/components/report';
import aiAvatarUrl from '@/assets/ai-assistant.png';
import type { DailyReport, TaskSourceGroup } from '@shared/api.interface';

interface DepartmentReportDocumentProps {
  title: string;
  subtitle: string;
  meta?: string;
  reportCount: number;
  issueCount: number;
  summaryContent?: string;
  issuesSummary?: string;
  taskSourceGroups: TaskSourceGroup[];
  issueReports: DailyReport[];
}

const DepartmentReportDocument: React.FC<DepartmentReportDocumentProps> = ({
  title,
  subtitle,
  meta,
  reportCount,
  issueCount,
  summaryContent,
  issuesSummary,
  taskSourceGroups,
  issueReports,
}) => {
  const summary: string = summaryContent?.trim() ?? '';
  const issuesSummaryText: string = issuesSummary?.trim() ?? '';

  return (
    <div className="space-y-5">
      <ReportHeader
        title={title}
        subtitle={subtitle}
        meta={meta}
        stats={[
          { label: '日报数量', value: reportCount, suffix: '篇' },
          { label: '卡点数', value: issueCount, suffix: '项' },
        ]}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">卡点与问题</h2>
        <IssueSection reports={issueReports} />
        {issuesSummaryText ? (
          <Card>
            <CardContent className="p-5">
              <Markdown className="text-sm leading-relaxed text-slate-700">
                {issuesSummaryText}
              </Markdown>
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">部门工作总结</h2>
        <Card>
          <CardContent className="p-5">
            {summary ? (
              <Markdown className="text-sm leading-relaxed text-slate-700">
                {summary}
              </Markdown>
            ) : (
              <p className="text-sm text-slate-500">暂无部门工作总结</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">按任务来源明细</h2>
        {taskSourceGroups.length > 0 ? (
          <div className="space-y-3">
            {taskSourceGroups.map((group: TaskSourceGroup) => (
              <TaskSourceGroupSection key={group.taskSource} group={group} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Image
                src={aiAvatarUrl}
                alt="BSS 智能助手形象"
                className="size-16 rounded-full object-cover shadow-sm ring-2 ring-primary/10"
              />
              <div className="space-y-0.5">
                <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-800">
                  <FileText className="size-4 text-slate-400" aria-hidden />
                  本期没有日报明细
                </p>
                <p className="text-xs text-slate-500">
                  员工提交日报后会自动汇总到部门报告中
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
};

export default DepartmentReportDocument;
