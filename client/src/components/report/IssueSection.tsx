import React from 'react';
import { LifeBuoy } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import aiAvatarUrl from '@/assets/ai-assistant.png';
import { Image } from '@client/src/components/ui/image';
import type { DailyReport } from '@shared/api.interface';

interface IssueSectionProps {
  reports: DailyReport[];
}

const IssueSection: React.FC<IssueSectionProps> = ({ reports }) => {
  if (!reports || reports.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Image
            src={aiAvatarUrl}
            alt="BSS 智能助手形象"
            className="size-14 rounded-full object-cover shadow-sm ring-2 ring-primary/10"
          />
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-slate-800">本周无卡点与问题</p>
            <p className="text-xs text-slate-500">各项工作均在正常推进</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <Card key={report.id} className="border-l-4 border-l-rose-500">
          <CardContent className="space-y-2.5 p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-semibold text-slate-800">{report.taskName}</span>
              <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                卡点
              </Badge>
              <span className="text-xs tabular-nums text-slate-500">
                {report.reportDate} ·
                {report.projectName?.length
                  ? report.projectName.join('、')
                  : '未关联项目'}
              </span>
            </div>
            {report.assistanceNeeded?.trim() ? (
              <p className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                <LifeBuoy className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
                <span>
                  <span className="font-medium text-amber-700">所需支持：</span>
                  {report.assistanceNeeded}
                </span>
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default IssueSection;
