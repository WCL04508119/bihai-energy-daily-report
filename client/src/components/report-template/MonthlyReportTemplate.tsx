import React from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type {
  ReportGoalRow,
  ReportIssueRow,
  ReportMilestoneRow,
  ReportNextPlanRow,
  TaskSource,
  MonthlyTemplateData,
} from '@shared/api.interface';

interface MonthlyReportTemplateProps {
  templateData: MonthlyTemplateData;
  ownerNameMap?: Record<string, string>;
  className?: string;
  /** 开启在线编辑（受控：编辑结果通过 onDataChange 回传） */
  editable?: boolean;
  /** 任何字段变更时回传「新」的整份 templateData */
  onDataChange?: (data: MonthlyTemplateData) => void;
}

const EMPTY_TEXT = '—';

const CELL_BASE = 'border border-slate-200 align-top text-sm text-slate-700';
const TEXT_CELL = `${CELL_BASE} whitespace-pre-wrap break-words`;
const PLAIN_CELL = `${CELL_BASE} whitespace-nowrap`;
const EDIT_CELL = `${CELL_BASE} p-2`;
const HEAD_CELL = 'border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600';

const INPUT_CLASS = 'h-9 min-w-[110px] border-slate-200 bg-white text-sm';
const TEXTAREA_CLASS = 'min-h-16 min-w-[160px] border-slate-200 bg-white text-sm';

const textOf = (value?: string | null): string => {
  const text: string = value?.trim() ?? '';
  return text.length > 0 ? text : EMPTY_TEXT;
};

const ownersOf = (
  ownerIds: string[],
  ownerNameMap?: Record<string, string>,
): string => {
  if (!Array.isArray(ownerIds) || ownerIds.length === 0) {
    return EMPTY_TEXT;
  }
  const names: string[] = ownerIds.map((id: string) => {
    const name: string | undefined = ownerNameMap?.[id];
    return name?.trim() ? name : id;
  });
  return names.join('、');
};

// 编辑时保留用户正在输入的自由文本；读取侧由 parseMonthlyTemplateData 兜底校验
const toTaskSource = (value: string): TaskSource | undefined =>
  value.trim().length === 0 ? undefined : (value as TaskSource);

const toIssueType = (
  value: string,
): ReportIssueRow['issueType'] | undefined =>
  value.trim().length === 0
    ? undefined
    : (value as ReportIssueRow['issueType']);

const cloneMonthlyTemplateData = (
  data: MonthlyTemplateData,
): MonthlyTemplateData => ({
  goalRows: (data.goalRows ?? []).map((row: ReportGoalRow) => ({ ...row })),
  milestoneRows: (data.milestoneRows ?? []).map((row: ReportMilestoneRow) => ({
    ...row,
  })),
  issueRows: (data.issueRows ?? []).map((row: ReportIssueRow) => ({
    ...row,
    ownerIds: [...(row.ownerIds ?? [])],
  })),
  ...(data.nextPlanRows
    ? {
        nextPlanRows: data.nextPlanRows.map((row: ReportNextPlanRow) => ({
          ...row,
        })),
      }
    : {}),
});

interface EditFieldProps {
  value?: string;
  ariaLabel: string;
  onChange: (value: string) => void;
}

const EditInput: React.FC<EditFieldProps> = ({
  value,
  ariaLabel,
  onChange,
}) => (
  <Input
    value={value ?? ''}
    aria-label={ariaLabel}
    className={INPUT_CLASS}
    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
      onChange(event.target.value)
    }
  />
);

const EditTextarea: React.FC<EditFieldProps> = ({
  value,
  ariaLabel,
  onChange,
}) => (
  <Textarea
    value={value ?? ''}
    aria-label={ariaLabel}
    className={TEXTAREA_CLASS}
    onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
      onChange(event.target.value)
    }
  />
);

interface TemplateSectionProps {
  title: string;
  note?: string;
  children: React.ReactNode;
}

const TemplateSection: React.FC<TemplateSectionProps> = ({
  title,
  note,
  children,
}) => (
  <section className="break-inside-avoid rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-l-4 border-l-primary pl-3">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      {note ? (
        <span className="text-xs font-normal text-slate-500">{note}</span>
      ) : null}
    </div>
    {children}
  </section>
);

interface EmptyRowProps {
  colSpan: number;
}

const EmptyRow: React.FC<EmptyRowProps> = ({ colSpan }) => (
  <TableRow>
    <TableCell
      colSpan={colSpan}
      className="border border-slate-200 py-6 text-center text-sm text-slate-500"
    >
      暂无数据
    </TableCell>
  </TableRow>
);

interface AddRowButtonProps {
  label: string;
  onClick: () => void;
}

const AddRowButton: React.FC<AddRowButtonProps> = ({ label, onClick }) => (
  <Button
    type="button"
    variant="outline"
    size="sm"
    className="mt-3 bg-white"
    onClick={onClick}
  >
    <Plus />
    {label}
  </Button>
);

interface DeleteRowButtonProps {
  ariaLabel: string;
  onClick: () => void;
}

const DeleteRowButton: React.FC<DeleteRowButtonProps> = ({
  ariaLabel,
  onClick,
}) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    className="text-destructive hover:text-destructive"
    aria-label={ariaLabel}
    onClick={onClick}
  >
    删除
  </Button>
);

const MonthlyReportTemplate: React.FC<MonthlyReportTemplateProps> = ({
  templateData,
  ownerNameMap,
  className,
  editable = false,
  onDataChange,
}) => {
  const goalRows: ReportGoalRow[] = templateData.goalRows ?? [];
  const milestoneRows: ReportMilestoneRow[] = templateData.milestoneRows ?? [];
  const issueRows: ReportIssueRow[] = templateData.issueRows ?? [];

  const emit = (mutate: (draft: MonthlyTemplateData) => void): void => {
    const draft: MonthlyTemplateData = cloneMonthlyTemplateData(templateData);
    mutate(draft);
    onDataChange?.(draft);
  };

  const updateGoalRow = (
    index: number,
    patch: Partial<ReportGoalRow>,
  ): void => {
    emit((draft: MonthlyTemplateData) => {
      draft.goalRows[index] = { ...draft.goalRows[index], ...patch };
    });
  };

  const updateMilestoneRow = (
    index: number,
    patch: Partial<ReportMilestoneRow>,
  ): void => {
    emit((draft: MonthlyTemplateData) => {
      draft.milestoneRows[index] = { ...draft.milestoneRows[index], ...patch };
    });
  };

  const updateIssueRow = (
    index: number,
    patch: Partial<ReportIssueRow>,
  ): void => {
    emit((draft: MonthlyTemplateData) => {
      draft.issueRows[index] = { ...draft.issueRows[index], ...patch };
    });
  };

  const actionHead: React.ReactNode = editable ? (
    <TableHead className={HEAD_CELL}>操作</TableHead>
  ) : null;

  const actionCell = (index: number, onDelete: () => void): React.ReactNode =>
    editable ? (
      <TableCell className={EDIT_CELL}>
        <DeleteRowButton
          ariaLabel={`删除第 ${index + 1} 行`}
          onClick={onDelete}
        />
      </TableCell>
    ) : null;

  return (
    <div className={cn('space-y-5', className)} data-ai-section-type="card-list">
      <TemplateSection
        title="一、本月目标完成情况"
        note="（必填；部分完成 / 未完成时偏差原因必填）"
      >
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={HEAD_CELL}>序号</TableHead>
              <TableHead className={HEAD_CELL}>任务来源</TableHead>
              <TableHead className={HEAD_CELL}>项目编号</TableHead>
              <TableHead className={HEAD_CELL}>项目名称/任务名称</TableHead>
              <TableHead className={HEAD_CELL}>本月目标（同上月计划）</TableHead>
              <TableHead className={HEAD_CELL}>实际完成及交付物</TableHead>
              <TableHead className={HEAD_CELL}>偏差原因</TableHead>
              {actionHead}
            </TableRow>
          </TableHeader>
          <TableBody>
            {goalRows.length > 0 ? (
              goalRows.map((row: ReportGoalRow, index: number) => (
                <TableRow key={`goal-${index}`} className="hover:bg-transparent">
                  <TableCell className={PLAIN_CELL}>{index + 1}</TableCell>
                  <TableCell className={editable ? EDIT_CELL : PLAIN_CELL}>
                    {editable ? (
                      <EditInput
                        value={row.taskSource}
                        ariaLabel={`第 ${index + 1} 行任务来源`}
                        onChange={(value: string) =>
                          updateGoalRow(index, {
                            taskSource: toTaskSource(value),
                          })
                        }
                      />
                    ) : (
                      textOf(row.taskSource)
                    )}
                  </TableCell>
                  <TableCell className={editable ? EDIT_CELL : PLAIN_CELL}>
                    {editable ? (
                      <EditInput
                        value={row.projectCode}
                        ariaLabel={`第 ${index + 1} 行项目编号`}
                        onChange={(value: string) =>
                          updateGoalRow(index, { projectCode: value })
                        }
                      />
                    ) : (
                      textOf(row.projectCode)
                    )}
                  </TableCell>
                  <TableCell className={editable ? EDIT_CELL : TEXT_CELL}>
                    {editable ? (
                      <EditTextarea
                        value={row.projectName}
                        ariaLabel={`第 ${index + 1} 行项目名称或任务名称`}
                        onChange={(value: string) =>
                          updateGoalRow(index, { projectName: value })
                        }
                      />
                    ) : (
                      textOf(row.projectName)
                    )}
                  </TableCell>
                  <TableCell className={editable ? EDIT_CELL : TEXT_CELL}>
                    {editable ? (
                      <EditTextarea
                        value={row.goal}
                        ariaLabel={`第 ${index + 1} 行本月目标`}
                        onChange={(value: string) =>
                          updateGoalRow(index, { goal: value })
                        }
                      />
                    ) : (
                      textOf(row.goal)
                    )}
                  </TableCell>
                  <TableCell className={editable ? EDIT_CELL : TEXT_CELL}>
                    {editable ? (
                      <EditTextarea
                        value={row.actualOutput}
                        ariaLabel={`第 ${index + 1} 行实际完成及交付物`}
                        onChange={(value: string) =>
                          updateGoalRow(index, { actualOutput: value })
                        }
                      />
                    ) : (
                      textOf(row.actualOutput)
                    )}
                  </TableCell>
                  <TableCell className={editable ? EDIT_CELL : TEXT_CELL}>
                    {editable ? (
                      <EditTextarea
                        value={row.deviationReason}
                        ariaLabel={`第 ${index + 1} 行偏差原因`}
                        onChange={(value: string) =>
                          updateGoalRow(index, { deviationReason: value })
                        }
                      />
                    ) : (
                      textOf(row.deviationReason)
                    )}
                  </TableCell>
                  {actionCell(index, () =>
                    emit((draft: MonthlyTemplateData) => {
                      draft.goalRows.splice(index, 1);
                    }),
                  )}
                </TableRow>
              ))
            ) : (
              <EmptyRow colSpan={editable ? 8 : 7} />
            )}
          </TableBody>
        </Table>
        {editable ? (
          <AddRowButton
            label="添加一行"
            onClick={() =>
              emit((draft: MonthlyTemplateData) => {
                draft.goalRows.push({});
              })
            }
          />
        ) : null}
      </TemplateSection>

      <TemplateSection title="二、关键节点完成情况">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={HEAD_CELL}>序号</TableHead>
              <TableHead className={HEAD_CELL}>任务来源</TableHead>
              <TableHead className={HEAD_CELL}>项目编号</TableHead>
              <TableHead className={HEAD_CELL}>项目名称/任务名称</TableHead>
              <TableHead className={HEAD_CELL}>节点名称</TableHead>
              <TableHead className={HEAD_CELL}>计划日期</TableHead>
              <TableHead className={HEAD_CELL}>实际 / 预计日期</TableHead>
              <TableHead className={HEAD_CELL}>节点状态</TableHead>
              <TableHead className={HEAD_CELL}>说明</TableHead>
              {actionHead}
            </TableRow>
          </TableHeader>
          <TableBody>
            {milestoneRows.length > 0 ? (
              milestoneRows.map((row: ReportMilestoneRow, index: number) => (
                <TableRow
                  key={`milestone-${index}`}
                  className="hover:bg-transparent"
                >
                  <TableCell className={PLAIN_CELL}>{index + 1}</TableCell>
                  <TableCell className={editable ? EDIT_CELL : PLAIN_CELL}>
                    {editable ? (
                      <EditInput
                        value={row.taskSource}
                        ariaLabel={`第 ${index + 1} 行任务来源`}
                        onChange={(value: string) =>
                          updateMilestoneRow(index, {
                            taskSource: toTaskSource(value),
                          })
                        }
                      />
                    ) : (
                      textOf(row.taskSource)
                    )}
                  </TableCell>
                  <TableCell className={editable ? EDIT_CELL : PLAIN_CELL}>
                    {editable ? (
                      <EditInput
                        value={row.projectCode}
                        ariaLabel={`第 ${index + 1} 行项目编号`}
                        onChange={(value: string) =>
                          updateMilestoneRow(index, { projectCode: value })
                        }
                      />
                    ) : (
                      textOf(row.projectCode)
                    )}
                  </TableCell>
                  <TableCell className={editable ? EDIT_CELL : TEXT_CELL}>
                    {editable ? (
                      <EditTextarea
                        value={row.projectName}
                        ariaLabel={`第 ${index + 1} 行项目名称或任务名称`}
                        onChange={(value: string) =>
                          updateMilestoneRow(index, { projectName: value })
                        }
                      />
                    ) : (
                      textOf(row.projectName)
                    )}
                  </TableCell>
                  <TableCell className={editable ? EDIT_CELL : TEXT_CELL}>
                    {editable ? (
                      <EditTextarea
                        value={row.nodeName}
                        ariaLabel={`第 ${index + 1} 行节点名称`}
                        onChange={(value: string) =>
                          updateMilestoneRow(index, { nodeName: value })
                        }
                      />
                    ) : (
                      textOf(row.nodeName)
                    )}
                  </TableCell>
                  <TableCell className={editable ? EDIT_CELL : PLAIN_CELL}>
                    {editable ? (
                      <EditInput
                        value={row.plannedDate}
                        ariaLabel={`第 ${index + 1} 行计划日期`}
                        onChange={(value: string) =>
                          updateMilestoneRow(index, { plannedDate: value })
                        }
                      />
                    ) : (
                      textOf(row.plannedDate)
                    )}
                  </TableCell>
                  <TableCell className={editable ? EDIT_CELL : PLAIN_CELL}>
                    {editable ? (
                      <EditInput
                        value={row.actualDate}
                        ariaLabel={`第 ${index + 1} 行实际或预计日期`}
                        onChange={(value: string) =>
                          updateMilestoneRow(index, { actualDate: value })
                        }
                      />
                    ) : (
                      textOf(row.actualDate)
                    )}
                  </TableCell>
                  <TableCell className={editable ? EDIT_CELL : PLAIN_CELL}>
                    {editable ? (
                      <EditInput
                        value={row.nodeStatus}
                        ariaLabel={`第 ${index + 1} 行节点状态`}
                        onChange={(value: string) =>
                          updateMilestoneRow(index, { nodeStatus: value })
                        }
                      />
                    ) : (
                      textOf(row.nodeStatus)
                    )}
                  </TableCell>
                  <TableCell className={editable ? EDIT_CELL : TEXT_CELL}>
                    {editable ? (
                      <EditTextarea
                        value={row.note}
                        ariaLabel={`第 ${index + 1} 行说明`}
                        onChange={(value: string) =>
                          updateMilestoneRow(index, { note: value })
                        }
                      />
                    ) : (
                      textOf(row.note)
                    )}
                  </TableCell>
                  {actionCell(index, () =>
                    emit((draft: MonthlyTemplateData) => {
                      draft.milestoneRows.splice(index, 1);
                    }),
                  )}
                </TableRow>
              ))
            ) : (
              <EmptyRow colSpan={editable ? 10 : 9} />
            )}
          </TableBody>
        </Table>
        {editable ? (
          <AddRowButton
            label="添加一行"
            onClick={() =>
              emit((draft: MonthlyTemplateData) => {
                draft.milestoneRows.push({ nodeName: '' });
              })
            }
          />
        ) : null}
      </TemplateSection>

      <TemplateSection title="三、问题与协助">
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={HEAD_CELL}>序号</TableHead>
              <TableHead className={HEAD_CELL}>任务来源</TableHead>
              <TableHead className={HEAD_CELL}>项目编号</TableHead>
              <TableHead className={HEAD_CELL}>问题/风险描述</TableHead>
              <TableHead className={HEAD_CELL}>类型</TableHead>
              <TableHead className={HEAD_CELL}>原因及措施</TableHead>
              <TableHead className={HEAD_CELL}>责任人</TableHead>
              <TableHead className={HEAD_CELL}>状态</TableHead>
              <TableHead className={HEAD_CELL}>计划关闭日期</TableHead>
              {actionHead}
            </TableRow>
          </TableHeader>
          <TableBody>
            {issueRows.length > 0 ? (
              issueRows.map((row: ReportIssueRow, index: number) => (
                <TableRow key={`issue-${index}`} className="hover:bg-transparent">
                  <TableCell className={PLAIN_CELL}>{index + 1}</TableCell>
                  <TableCell className={editable ? EDIT_CELL : PLAIN_CELL}>
                    {editable ? (
                      <EditInput
                        value={row.taskSource}
                        ariaLabel={`第 ${index + 1} 行任务来源`}
                        onChange={(value: string) =>
                          updateIssueRow(index, {
                            taskSource: toTaskSource(value),
                          })
                        }
                      />
                    ) : (
                      textOf(row.taskSource)
                    )}
                  </TableCell>
                  <TableCell className={editable ? EDIT_CELL : PLAIN_CELL}>
                    {editable ? (
                      <EditInput
                        value={row.projectCode}
                        ariaLabel={`第 ${index + 1} 行项目编号`}
                        onChange={(value: string) =>
                          updateIssueRow(index, { projectCode: value })
                        }
                      />
                    ) : (
                      textOf(row.projectCode)
                    )}
                  </TableCell>
                  <TableCell className={editable ? EDIT_CELL : TEXT_CELL}>
                    {editable ? (
                      <EditTextarea
                        value={row.riskDesc}
                        ariaLabel={`第 ${index + 1} 行问题或风险描述`}
                        onChange={(value: string) =>
                          updateIssueRow(index, { riskDesc: value })
                        }
                      />
                    ) : (
                      textOf(row.riskDesc)
                    )}
                  </TableCell>
                  <TableCell className={editable ? EDIT_CELL : PLAIN_CELL}>
                    {editable ? (
                      <EditInput
                        value={row.issueType}
                        ariaLabel={`第 ${index + 1} 行类型`}
                        onChange={(value: string) =>
                          updateIssueRow(index, {
                            issueType: toIssueType(value),
                          })
                        }
                      />
                    ) : (
                      textOf(row.issueType)
                    )}
                  </TableCell>
                  <TableCell className={editable ? EDIT_CELL : TEXT_CELL}>
                    {editable ? (
                      <EditTextarea
                        value={row.causeAndAction}
                        ariaLabel={`第 ${index + 1} 行原因及措施`}
                        onChange={(value: string) =>
                          updateIssueRow(index, { causeAndAction: value })
                        }
                      />
                    ) : (
                      textOf(row.causeAndAction)
                    )}
                  </TableCell>
                  <TableCell className={TEXT_CELL}>
                    {ownersOf(row.ownerIds, ownerNameMap)}
                  </TableCell>
                  <TableCell className={editable ? EDIT_CELL : PLAIN_CELL}>
                    {editable ? (
                      <EditInput
                        value={row.status}
                        ariaLabel={`第 ${index + 1} 行状态`}
                        onChange={(value: string) =>
                          updateIssueRow(index, { status: value })
                        }
                      />
                    ) : (
                      textOf(row.status)
                    )}
                  </TableCell>
                  <TableCell className={editable ? EDIT_CELL : PLAIN_CELL}>
                    {editable ? (
                      <EditInput
                        value={row.plannedCloseDate}
                        ariaLabel={`第 ${index + 1} 行计划关闭日期`}
                        onChange={(value: string) =>
                          updateIssueRow(index, { plannedCloseDate: value })
                        }
                      />
                    ) : (
                      textOf(row.plannedCloseDate)
                    )}
                  </TableCell>
                  {actionCell(index, () =>
                    emit((draft: MonthlyTemplateData) => {
                      draft.issueRows.splice(index, 1);
                    }),
                  )}
                </TableRow>
              ))
            ) : (
              <EmptyRow colSpan={editable ? 10 : 9} />
            )}
          </TableBody>
        </Table>
        {editable ? (
          <AddRowButton
            label="添加一行"
            onClick={() =>
              emit((draft: MonthlyTemplateData) => {
                draft.issueRows.push({ riskDesc: '', ownerIds: [] });
              })
            }
          />
        ) : null}
      </TemplateSection>
    </div>
  );
};

export default MonthlyReportTemplate;
