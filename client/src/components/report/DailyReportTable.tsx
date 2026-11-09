import React from 'react';
import { AlertTriangle } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import aiAvatarUrl from '@/assets/ai-assistant.png';
import { Image } from '@client/src/components/ui/image';
import type { DailyReport } from '@shared/api.interface';
import { isIssueReport } from '@/utils/report-group';

export const statusStyle: Record<string, string> = {
  按计划完成: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  提前完成: 'border-sky-200 bg-sky-50 text-sky-700',
  部分完成: 'border-amber-200 bg-amber-50 text-amber-700',
  未完成: 'border-rose-200 bg-rose-50 text-rose-700',
  无计划事项: 'border-slate-200 bg-slate-100 text-slate-600',
};

const hasIssue = (report: DailyReport): boolean => isIssueReport(report);

const projectLabel = (report: DailyReport): string =>
  report.projectName && report.projectName.length > 0
    ? report.projectName.join('、')
    : '-';

interface DailyReportTableProps {
  reports: DailyReport[];
  emptyText?: string;
}

const DailyReportTable: React.FC<DailyReportTableProps> = ({ reports, emptyText }) => {
  if (!reports || reports.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
        <Image
          src={aiAvatarUrl}
          alt="BSS 智能助手形象"
          className="size-14 rounded-full object-cover shadow-sm ring-2 ring-primary/10"
        />
        <p className="text-sm text-slate-500">{emptyText || '暂无日报明细'}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
          <TableHead className="font-semibold text-slate-600">日期</TableHead>
          <TableHead className="font-semibold text-slate-600">任务名称</TableHead>
          <TableHead className="font-semibold text-slate-600">项目名称</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reports.map((report) => (
          <TableRow key={report.id} className="transition-colors hover:bg-primary/[0.025]">
            <TableCell className="whitespace-nowrap tabular-nums text-slate-700">
              {report.reportDate}
            </TableCell>
            <TableCell className="max-w-[220px]">
              <span className="flex items-center gap-1.5">
                <span className="truncate font-medium text-slate-800" title={report.taskName}>
                  {report.taskName}
                </span>
                {hasIssue(report) ? (
                  <AlertTriangle
                    className="size-3.5 shrink-0 text-amber-500"
                    aria-label="该条目存在卡点或问题"
                  />
                ) : null}
              </span>
            </TableCell>
            <TableCell className="max-w-[180px] truncate text-slate-600">
              {projectLabel(report)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default DailyReportTable;
