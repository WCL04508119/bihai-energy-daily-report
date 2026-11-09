import React from 'react';

import { Card, CardContent } from '@/components/ui/card';
import DailyReportTable from './DailyReportTable';
import type { TaskSourceGroup } from '@shared/api.interface';

interface TaskSourceGroupSectionProps {
  group: TaskSourceGroup;
  emptyText?: string;
}

const TaskSourceGroupSection: React.FC<TaskSourceGroupSectionProps> = ({ group, emptyText }) => {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <h3 className="text-base font-semibold text-slate-800">
          {group.taskSource}
          <span className="ml-2 text-xs font-normal text-slate-500">
            {group.taskCount} 项任务
          </span>
        </h3>
      </CardContent>
      <CardContent className="p-0">
        <DailyReportTable reports={group.reports} emptyText={emptyText} />
      </CardContent>
    </Card>
  );
};

export default TaskSourceGroupSection;
