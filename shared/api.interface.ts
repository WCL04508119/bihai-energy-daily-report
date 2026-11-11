export const DEPARTMENTS = [
  '仪电室', '产品创新室', '工艺模块室', '热工室', '工业炉室',
  '项目部', '财务部', '人力资源部', '国际市场部', '国内市场部',
  '行政部', '公司领导', '部门领导'
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const TASK_SOURCES = [
  '部门日常', '项目任务', '投标项目', '临时需求', '会议安排', '跨部门协作',
  '其他任务', '行政工作', '飞书任务'
] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

export const COMPLETION_STATUSES = [
  '按计划完成', '提前完成', '部分完成', '未完成', '无计划事项'
] as const;
export type CompletionStatus = (typeof COMPLETION_STATUSES)[number];

export const isDepartment = (v: string): v is Department =>
  (DEPARTMENTS as readonly string[]).includes(v);

/** 室主任的日报固定归属本部门（优先级高于通讯录映射，创建/编辑时强制归正） */
export const DIRECTOR_DEPARTMENTS: Record<string, Department> = {
  '1868746263437415': '仪电室',
  '1880349984698391': '工艺模块室',
  '1880255167891609': '热工室',
  '1880349984687399': '工业炉室',
};

export const resolveDirectorDepartment = (
  userId: string,
): Department | null => DIRECTOR_DEPARTMENTS[userId] ?? null;
export const isTaskSource = (v: string): v is TaskSource =>
  (TASK_SOURCES as readonly string[]).includes(v);
export const isCompletionStatus = (v: string): v is CompletionStatus =>
  (COMPLETION_STATUSES as readonly string[]).includes(v);

export interface TaskItem {
  id: string;
  assigneeId: string;
  assigneeName?: string;
  title: string;
  externalId?: string;
}

export interface CreateTaskItemRequest {
  assigneeId: string;
  title: string;
}

export interface UpdateTaskItemRequest {
  title: string;
}

export interface TaskItemListResponse {
  items: TaskItem[];
}

export interface TaskPoolSyncResponse {
  listGuid: string;
  total: number;
  added: number;
  updated: number;
  skippedNoAssignee: number;
  convertedFailed: number;
  source: 'personal' | 'shared';
  needAuth: boolean;
}

export interface FeishuAuthUrlResponse {
  url: string;
}

export interface FeishuAuthBindRequest {
  code: string;
  redirectUri: string;
}

export interface FeishuAuthStatusResponse {
  connected: boolean;
  expiresAt: string | null;
}

export interface DeleteResponse {
  success: true;
}

export const COMPLETION_ROW_KINDS = ['routine', 'project'] as const;
export type CompletionRowKind = (typeof COMPLETION_ROW_KINDS)[number];
export const isCompletionRowKind = (v: string): v is CompletionRowKind =>
  (COMPLETION_ROW_KINDS as readonly string[]).includes(v);

export interface DailyCompletionRow {
  kind?: CompletionRowKind;
  projectNames: string[];
  projectCodes: string[];
  task?: string;
  completion?: string;
  workHours?: string;
}

export const isDailyCompletionRow = (v: unknown): v is DailyCompletionRow =>
  !!v &&
  typeof v === 'object' &&
  Array.isArray((v as DailyCompletionRow).projectNames) &&
  Array.isArray((v as DailyCompletionRow).projectCodes);

export const formatCompletionRowsProjectTask = (
  rows: DailyCompletionRow[] | undefined,
  fallbackProjects: string[] | undefined,
): string | undefined => {
  const lines: string[] = (rows ?? [])
    .map((row: DailyCompletionRow) => {
      const project: string = (row.projectNames ?? [])
        .filter(Boolean)
        .join('、');
      const task: string = row.task?.trim() ?? '';
      return [project, task].filter(Boolean).join(' · ');
    })
    .filter(Boolean);
  if (lines.length > 0) return lines.join('；');
  const fallback: string = (fallbackProjects ?? []).filter(Boolean).join('、');
  return fallback ? fallback : undefined;
};

export interface DailyReport {
  id: string;
  reportDate: string;
  department: Department;
  taskSource: TaskSource;
  taskSources?: TaskSource[];
  taskName: string;
  projectName?: string[];
  projectCode?: string[];
  plmTask?: string;
  completionRows?: DailyCompletionRow[];
  dayCompletion?: string;
  outputFileCount: string;
  assistanceNeeded?: string;
  reporterId: string;
  reporterName?: string;
  recipients?: string[];
  cc?: string[];
  createdAt: string;
  updatedAt: string;
  /** 服务端下发的编辑权限：仅本人可编辑/删除 */
  canEdit?: boolean;
}

export interface CreateDailyReportRequest {
  reportDate: string;
  department: Department;
  taskSource: TaskSource;
  taskSources?: string[];
  taskName: string;
  projectName?: string[];
  projectCode?: string[];
  plmTask?: string;
  completionRows?: DailyCompletionRow[];
  dayCompletion?: string;
  outputFileCount: string;
  assistanceNeeded?: string;
  recipients?: string[];
  cc?: string[];
}

export interface UpdateDailyReportRequest extends Partial<CreateDailyReportRequest> {}

export interface RecipientDefaults {
  recipients: string[];
  cc: string[];
  source: 'self' | 'department' | 'none';
}

export interface MyDepartmentInfo {
  /** 当前用户在飞书通讯录中的所属部门（与 DEPARTMENTS 取值一致），未同步到时为 null */
  department: string | null;
}

export const DATA_SCOPE_KINDS = ['all', 'department', 'self'] as const;
export type DataScopeKind = (typeof DATA_SCOPE_KINDS)[number];

export interface DataScopeFeatures {
  isSystemAdmin: boolean;
  isDeptDirector: boolean;
  isCompanyLeader: boolean;
  isHrAdmin: boolean;
  canViewManagerDashboard: boolean;
  canViewStats: boolean;
  canManageTaskPool: boolean;
}

export interface DataScopeInfo {
  kind: DataScopeKind;
  departments: string[];
  features: DataScopeFeatures;
}

export const MANAGER_PERIODS = ['day', 'week', 'month'] as const;
export type ManagerPeriod = (typeof MANAGER_PERIODS)[number];
export const MANAGER_PERIOD_LABELS: Record<ManagerPeriod, string> = {
  day: '日',
  week: '周',
  month: '月',
};

export interface ManagerMetric {
  name: string;
  count: number;
  peopleCount: number;
}

export interface ManagerDepartmentRow {
  department: string;
  reportCount: number;
  peopleCount: number;
  projectCount: number;
  issueCount: number;
  taskSources: ManagerMetric[];
  topProjects: ManagerMetric[];
}

export interface ManagerPersonRow {
  userId: string;
  name: string;
  department: string;
  reportCount: number;
  activeDays: number;
  projectCount: number;
  issueCount: number;
  taskSources: ManagerMetric[];
}

export interface ManagerTotals {
  reportCount: number;
  peopleCount: number;
  departmentCount: number;
  projectCount: number;
  issueCount: number;
}

export interface ManagerDashboardResponse {
  period: ManagerPeriod;
  rangeStart: string;
  rangeEnd: string;
  rangeLabel: string;
  totals: ManagerTotals;
  byDepartment: ManagerDepartmentRow[];
  byPerson: ManagerPersonRow[];
  byTaskSource: ManagerMetric[];
  byProject: ManagerMetric[];
}

export const MANAGER_ANALYSIS_DIMENSIONS = ['all', 'project', 'task'] as const;
export type ManagerAnalysisDimension =
  (typeof MANAGER_ANALYSIS_DIMENSIONS)[number];
export const MANAGER_ANALYSIS_DIMENSION_LABELS: Record<
  ManagerAnalysisDimension,
  string
> = {
  all: '综合分析',
  project: '按项目',
  task: '按任务',
};

export interface ManagerAnalysisIssueItem {
  reportDate: string;
  department: string;
  personName: string;
  taskSources: string[];
  projectNames: string[];
  taskName: string;
  assistanceNeeded: string;
}

export interface ManagerAnalysisCompletionItem {
  reportDate: string;
  department: string;
  personName: string;
  projectNames: string[];
  taskName: string;
  completion: string;
}

export interface ManagerAnalysisContext {
  period: ManagerPeriod;
  rangeLabel: string;
  scopeLabel: string;
  totals: ManagerTotals;
  byDepartment: ManagerDepartmentRow[];
  byTaskSource: ManagerMetric[];
  byProject: ManagerMetric[];
  issueItems: ManagerAnalysisIssueItem[];
  completionItems: ManagerAnalysisCompletionItem[];
  truncated: boolean;
}

export interface DailyReportListResponse {  items: DailyReport[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DailyReportListQuery {
  page?: number;
  pageSize?: number;
  department?: string;
  startDate?: string;
  endDate?: string;
  reporterId?: string;
  /** 填报人姓名关键词（服务端按姓名模糊匹配 reporterId） */
  keyword?: string;
}

export interface ReportGoalRow {
  taskSource?: TaskSource;
  projectCode?: string;
  projectName?: string;
  goal?: string;
  actualOutput?: string;
  deviationReason?: string;
}

export interface ReportIssueRow {
  taskSource?: TaskSource;
  projectCode?: string;
  projectName?: string;
  riskDesc: string;
  issueType?: '潜在风险' | '已发生问题';
  causeAndAction?: string;
  ownerIds: string[];
  status?: string;
  supportNeeded?: string;
  plannedCloseDate?: string;
}

export interface ReportNextPlanRow {
  taskSource?: TaskSource;
  projectCode?: string;
  keyTask: string;
  deliverable?: string;
  dueDate?: string;
  resourcesNeeded?: string;
}

export interface ReportMilestoneRow {
  taskSource?: TaskSource;
  projectCode?: string;
  projectName?: string;
  nodeName: string;
  plannedDate?: string;
  actualDate?: string;
  nodeStatus?: string;
  note?: string;
}

export interface WeeklyTemplateData {
  goalRows: ReportGoalRow[];
  issueRows: ReportIssueRow[];
  summaryPoints: string[];
  nextPlanRows: ReportNextPlanRow[];
}

export interface MonthlyTemplateData {
  goalRows: ReportGoalRow[];
  milestoneRows: ReportMilestoneRow[];
  issueRows: ReportIssueRow[];
  nextPlanRows?: ReportNextPlanRow[];
}

export interface WeeklyReport {
  id: string;
  weekStart: string;
  weekEnd: string;
  department: Department;
  summaryContent?: string;
  totalWorkHours: number;
  completionRate: number;
  reportCount: number;
  reporterId: string;
  createdAt: string;
  updatedAt: string;
  templateData?: WeeklyTemplateData;
  dailyReports?: DailyReport[];
}

export interface WeeklyReportListResponse {
  items: WeeklyReport[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WeeklyReportListQuery {
  page?: number;
  pageSize?: number;
  department?: string;
  reporterId?: string;
  weekStart?: string;
}

export interface MonthlyReport {
  id: string;
  reportMonth: string;
  department: Department;
  summaryContent?: string;
  totalWorkHours: number;
  completionRate: number;
  reportCount: number;
  reporterId: string;
  createdAt: string;
  updatedAt: string;
  templateData?: MonthlyTemplateData;
}

export interface MonthlyReportListResponse {
  items: MonthlyReport[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MonthlyReportListQuery {
  page?: number;
  pageSize?: number;
  department?: string;
  reporterId?: string;
  reportMonth?: string;
}

export interface DepartmentWeeklyReport {
  id: string;
  department: Department;
  weekStart: string;
  weekEnd: string;
  summaryContent?: string;
  issuesSummary?: string;
  reportCount: number;
  totalWorkHours: number;
  completionRate: number;
  issueCount: number;
  generatorId: string;
  createdAt: string;
  updatedAt: string;
  templateData?: WeeklyTemplateData;
}

export interface CreateDepartmentWeeklyReportRequest {
  department: Department;
  weekStart: string;
  summaryContent: string;
  issuesSummary?: string;
  templateData?: WeeklyTemplateData;
}

export interface DepartmentWeeklyReportListResponse {
  items: DepartmentWeeklyReport[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DepartmentWeeklyReportListQuery {
  page?: number;
  pageSize?: number;
  department?: string;
  weekStart?: string;
}

export interface DepartmentMonthlyReport {
  id: string;
  department: Department;
  reportMonth: string;
  summaryContent?: string;
  issuesSummary?: string;
  reportCount: number;
  totalWorkHours: number;
  completionRate: number;
  issueCount: number;
  generatorId: string;
  createdAt: string;
  updatedAt: string;
  templateData?: MonthlyTemplateData;
}

export interface CreateDepartmentMonthlyReportRequest {
  department: Department;
  reportMonth: string;
  summaryContent: string;
  issuesSummary?: string;
  templateData?: MonthlyTemplateData;
}

export interface DepartmentMonthlyReportListResponse {
  items: DepartmentMonthlyReport[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DepartmentMonthlyReportListQuery {
  page?: number;
  pageSize?: number;
  department?: string;
  reportMonth?: string;
}

export interface TaskSourceGroup {
  taskSource: TaskSource;
  taskCount: number;
  reports: DailyReport[];
}

export interface DepartmentWeeklyReportDetail extends DepartmentWeeklyReport {
  taskSourceGroups: TaskSourceGroup[];
  issueReports: DailyReport[];
}

export interface DepartmentMonthlyReportDetail extends DepartmentMonthlyReport {
  taskSourceGroups: TaskSourceGroup[];
  issueReports: DailyReport[];
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const asText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;
const asNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const toGoalRow = (raw: unknown): ReportGoalRow | null => {
  const record = asRecord(raw);
  if (!record) return null;
  const row: ReportGoalRow = {};
  const taskSource = asText(record.taskSource);
  if (taskSource && isTaskSource(taskSource)) row.taskSource = taskSource;
  row.projectCode = asText(record.projectCode);
  row.projectName = asText(record.projectName);
  row.goal = asText(record.goal);
  row.actualOutput = asText(record.actualOutput);
  row.deviationReason = asText(record.deviationReason);
  return row;
};

const toIssueRow = (raw: unknown): ReportIssueRow | null => {
  const record = asRecord(raw);
  if (!record) return null;
  const riskDesc = asText(record.riskDesc);
  if (!riskDesc) return null;
  const row: ReportIssueRow = {
    riskDesc,
    ownerIds: asArray(record.ownerIds).filter(
      (id: unknown): id is string => typeof id === 'string',
    ),
  };
  const taskSource = asText(record.taskSource);
  if (taskSource && isTaskSource(taskSource)) row.taskSource = taskSource;
  const issueType = asText(record.issueType);
  if (issueType === '潜在风险' || issueType === '已发生问题') {
    row.issueType = issueType;
  }
  row.projectCode = asText(record.projectCode);
  row.projectName = asText(record.projectName);
  row.causeAndAction = asText(record.causeAndAction);
  row.status = asText(record.status);
  row.supportNeeded = asText(record.supportNeeded);
  row.plannedCloseDate = asText(record.plannedCloseDate);
  return row;
};

const toNextPlanRow = (raw: unknown): ReportNextPlanRow | null => {
  const record = asRecord(raw);
  if (!record) return null;
  const keyTask = asText(record.keyTask);
  if (!keyTask) return null;
  const row: ReportNextPlanRow = { keyTask };
  const taskSource = asText(record.taskSource);
  if (taskSource && isTaskSource(taskSource)) row.taskSource = taskSource;
  row.projectCode = asText(record.projectCode);
  row.deliverable = asText(record.deliverable);
  row.dueDate = asText(record.dueDate);
  row.resourcesNeeded = asText(record.resourcesNeeded);
  return row;
};

const toMilestoneRow = (raw: unknown): ReportMilestoneRow | null => {
  const record = asRecord(raw);
  if (!record) return null;
  const nodeName = asText(record.nodeName);
  if (!nodeName) return null;
  const row: ReportMilestoneRow = { nodeName };
  const taskSource = asText(record.taskSource);
  if (taskSource && isTaskSource(taskSource)) row.taskSource = taskSource;
  row.projectCode = asText(record.projectCode);
  row.projectName = asText(record.projectName);
  row.plannedDate = asText(record.plannedDate);
  row.actualDate = asText(record.actualDate);
  row.nodeStatus = asText(record.nodeStatus);
  row.note = asText(record.note);
  return row;
};

const compact = <T>(items: Array<T | null>): T[] =>
  items.filter((item: T | null): item is T => item !== null);

export const parseWeeklyTemplateData = (
  value: unknown,
): WeeklyTemplateData | undefined => {
  const record = asRecord(value);
  if (!record) return undefined;
  return {
    goalRows: compact(asArray(record.goalRows).map(toGoalRow)),
    issueRows: compact(asArray(record.issueRows).map(toIssueRow)),
    summaryPoints: asArray(record.summaryPoints).filter(
      (item: unknown): item is string =>
        typeof item === 'string' && item.trim().length > 0,
    ),
    nextPlanRows: compact(asArray(record.nextPlanRows).map(toNextPlanRow)),
  };
};

export const parseMonthlyTemplateData = (
  value: unknown,
): MonthlyTemplateData | undefined => {
  const record = asRecord(value);
  if (!record) return undefined;
  return {
    goalRows: compact(asArray(record.goalRows).map(toGoalRow)),
    milestoneRows: compact(
      asArray(record.milestoneRows).map(toMilestoneRow),
    ),
    issueRows: compact(asArray(record.issueRows).map(toIssueRow)),
    nextPlanRows: compact(asArray(record.nextPlanRows).map(toNextPlanRow)),
  };
};

export interface SubmissionStats {
  date: string;
  totalUsers: number;
  submittedUsers: number;
  submissionRate: number;
  totalReports: number;
}

export interface DepartmentStats {
  department: Department;
  totalUsers: number;
  submittedUsers: number;
  submissionRate: number;
}

// 按人员 × 每月工作日出勤核对矩阵
// 工作日口径：周一至周五（不含周末）；无节假日历，法定节假日按工作日统计
export const ATTENDANCE_DAY_STATES = [
  'on-time',
  'supplement',
  'missing',
] as const;
export type AttendanceDayState = (typeof ATTENDANCE_DAY_STATES)[number];
export const ATTENDANCE_DAY_STATE_LABELS: Record<AttendanceDayState, string> = {
  'on-time': '当日提交',
  supplement: '补交',
  missing: '未提交',
};

export interface AttendanceDayCell {
  state: AttendanceDayState;
  submittedOn?: string; // 补交时的实际提交日期 YYYY-MM-DD
}

export interface AttendanceEmployee {
  userId: string;
  name: string;
  submittedDays: number; // 当月工作日中已提交日报的天数（含补交）
  missingDays: number; // 当月工作日中未提交日报的天数
  supplementCount: number; // 补交条数（报日早于实际提交日）
  days: Record<string, AttendanceDayCell>; // key=报日 YYYY-MM-DD
  supplementOn: Record<string, string[]>; // key=实际提交日，value=该日补交的报日列表
}

export interface AttendanceStats {
  month: string; // YYYY-MM
  workingDays: string[]; // 当月工作日日期列表 YYYY-MM-DD
  supplementTotal: number; // 全员补交条数
  employees: AttendanceEmployee[];
}

export interface AttendanceExportRequest {
  month: string; // YYYY-MM
}

export interface AttendanceExportResult {
  fileName: string;
  downloadUrl: string;
}

export const SCHEDULED_SEND_STATUSES = [
  'pending',
  'sent',
  'failed',
  'cancelled',
] as const;

export type ScheduledSendStatus = (typeof SCHEDULED_SEND_STATUSES)[number];

export const isScheduledSendStatus = (
  v: string,
): v is ScheduledSendStatus =>
  (SCHEDULED_SEND_STATUSES as readonly string[]).includes(v);

export const SCHEDULED_SEND_STATUS_LABELS: Record<
  ScheduledSendStatus,
  string
> = {
  pending: '待发送',
  sent: '已发送',
  failed: '发送失败',
  cancelled: '已取消',
};

export interface ScheduledReportSend {
  id: string;
  senderId: string;
  sendAt: string;
  report: CreateDailyReportRequest;
  recipientIds: string[];
  status: ScheduledSendStatus;
  sentAt?: string;
  errorMsg?: string;
  createdAt: string;
}

export interface CreateScheduledSendRequest {
  report: CreateDailyReportRequest;
  sendDate: string;
  sendTime: string;
  /** 兼容字段：接收人由日报的汇报人与抄送人自动推导，前端不再传 */
  recipientIds?: string[];
}

export interface ScheduledSendListResponse {
  items: ScheduledReportSend[];
  total: number;
}

export const REPORT_DOCUMENT_TYPES = [
  'weekly',
  'monthly',
  'department-weekly',
  'department-monthly',
] as const;
export type ReportDocumentType = (typeof REPORT_DOCUMENT_TYPES)[number];
export const isReportDocumentType = (v: string): v is ReportDocumentType =>
  (REPORT_DOCUMENT_TYPES as readonly string[]).includes(v);
export const REPORT_DOCUMENT_TYPE_LABELS: Record<ReportDocumentType, string> = {
  weekly: '个人周报',
  monthly: '个人月报',
  'department-weekly': '部门周报',
  'department-monthly': '部门月报',
};

export interface ExportReportDocumentRequest {
  reportType: ReportDocumentType;
  reportId: string;
}

export interface ReportDocument {
  id: string;
  reportType: ReportDocumentType;
  reportId: string;
  title: string;
  fileName: string;
  downloadUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportDocumentListResponse {
  items: ReportDocument[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReportDocumentListQuery {
  page?: number;
  pageSize?: number;
  reportType?: string;
}
