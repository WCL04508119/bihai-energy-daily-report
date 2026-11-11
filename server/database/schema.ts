/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { date, index, integer, jsonb, numeric, pgTable, text, uniqueIndex, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const feishuUserTokens = pgTable("feishu_user_tokens", {
  userId: varchar("user_id", { length: 64 }).primaryKey(),
  openId: varchar("open_id", { length: 64 }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: customTimestamptz("expires_at", { precision: 3 }).notNull(),
  scope: text("scope"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const userDepartments = pgTable("user_departments", {
  userId: varchar("user_id", { length: 64 }).primaryKey(),
  department: varchar("department", { length: 50 }).notNull(),
  source: varchar("source", { length: 20 }).notNull().default('feishu_contacts'),
  syncedAt: customTimestamptz("synced_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const taskItems = pgTable("task_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  assignee: userProfile("assignee").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  externalId: varchar("external_id", { length: 64 }).unique(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  // Complex index: CREATE INDEX idx_task_items_assignee ON task_items USING btree (((assignee).user_id)),
  uniqueIndex("idx_task_items_external").on(table.externalId),
]);

export const reportDocuments = pgTable("report_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportType: varchar("report_type", { length: 30 }).notNull(),
  reportId: uuid("report_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  downloadUrl: text("download_url").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_report_documents_created").on(table.createdAt),
  index("idx_report_documents_type").on(table.reportType, table.reportId),
]);

export const scheduledReportSends = pgTable("scheduled_report_sends", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: userProfile("sender_id").notNull(),
  sendAt: customTimestamptz("send_at", { precision: 6 }).notNull(),
  /**
   * @type { reportDate: string; department: string; taskSource: string; taskName: string; projectName: string; projectCode: string; projectPhase: string; plmTask: string; startTime: string; endTime: string; dayPlan: string; dayCompletion: string; content: string; outputContent: string; completionPercent: number; workHours: number; outputFileCount: number; drawingCount: number; deviationReason: string; assistanceNeeded: string; completionStatus: string }
   */
  reportPayload: jsonb("report_payload").notNull(),
  /**
   * @type string[]
   */
  recipientIds: jsonb("recipient_ids").notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  sentAt: customTimestamptz("sent_at", { precision: 6 }),
  errorMsg: text("error_msg"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_scheduled_report_sends_status").on(table.status, table.sendAt),
]);

export const departmentMonthlyReports = pgTable("department_monthly_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  department: varchar("department", { length: 50 }).notNull(),
  reportMonth: varchar("report_month", { length: 7 }).notNull(),
  summaryContent: text("summary_content"),
  issuesSummary: text("issues_summary"),
  reportCount: integer("report_count").notNull().default(0),
  totalWorkHours: numeric("total_work_hours").notNull().default('0'),
  completionRate: numeric("completion_rate").notNull().default('0'),
  issueCount: integer("issue_count").notNull().default(0),
  generatorId: userProfile("generator_id").notNull(),
  /**
   * @type Record<string, unknown>
   */
  templateData: jsonb("template_data"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_dept_monthly_reports_dept_month").on(table.department, table.reportMonth),
  index("idx_dept_monthly_reports_month").on(table.reportMonth),
]);

export const departmentWeeklyReports = pgTable("department_weekly_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  department: varchar("department", { length: 50 }).notNull(),
  weekStart: date("week_start").notNull(),
  weekEnd: date("week_end").notNull(),
  summaryContent: text("summary_content"),
  issuesSummary: text("issues_summary"),
  reportCount: integer("report_count").notNull().default(0),
  totalWorkHours: numeric("total_work_hours").notNull().default('0'),
  completionRate: numeric("completion_rate").notNull().default('0'),
  issueCount: integer("issue_count").notNull().default(0),
  generatorId: userProfile("generator_id").notNull(),
  /**
   * @type Record<string, unknown>
   */
  templateData: jsonb("template_data"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_dept_weekly_reports_dept_week").on(table.department, table.weekStart),
  index("idx_dept_weekly_reports_week").on(table.weekStart),
]);

export const monthlyReports = pgTable("monthly_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportMonth: varchar("report_month", { length: 7 }).notNull(),
  department: varchar("department", { length: 50 }).notNull(),
  summaryContent: text("summary_content"),
  totalWorkHours: numeric("total_work_hours").notNull().default('0'),
  completionRate: numeric("completion_rate").notNull().default('0'),
  reportCount: integer("report_count").notNull().default(0),
  reporterId: userProfile("reporter_id").notNull(),
  /**
   * @type Record<string, unknown>
   */
  templateData: jsonb("template_data"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  // Complex index: CREATE UNIQUE INDEX idx_monthly_reports_reporter_month ON monthly_reports USING btree (((reporter_id).user_id), report_month),
  index("idx_monthly_reports_department").on(table.department, table.reportMonth),
]);

export const weeklyReports = pgTable("weekly_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  weekStart: date("week_start").notNull(),
  weekEnd: date("week_end").notNull(),
  department: varchar("department", { length: 50 }).notNull(),
  summaryContent: text("summary_content"),
  totalWorkHours: numeric("total_work_hours").notNull().default('0'),
  completionRate: numeric("completion_rate").notNull().default('0'),
  reportCount: integer("report_count").notNull().default(0),
  reporterId: userProfile("reporter_id").notNull(),
  /**
   * @type Record<string, unknown>
   */
  templateData: jsonb("template_data"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  // Complex index: CREATE UNIQUE INDEX idx_weekly_reports_reporter_week ON weekly_reports USING btree (((reporter_id).user_id), week_start),
  index("idx_weekly_reports_department").on(table.department, table.weekStart),
]);

export const dailyReports = pgTable("daily_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportDate: date("report_date").notNull(),
  department: varchar("department", { length: 50 }).notNull(),
  taskSource: varchar("task_source", { length: 50 }).notNull(),
  taskName: varchar("task_name", { length: 255 }).notNull(),
  projectName: text("project_name").array(),
  projectCode: text("project_code").array(),
  plmTask: varchar("plm_task", { length: 255 }),
  dayCompletion: text("day_completion"),
  outputFileCount: text("output_file_count").notNull(),
  assistanceNeeded: text("assistance_needed"),
  reporterId: userProfile("reporter_id").notNull(),
  recipients: userProfileArray("recipients"),
  cc: userProfileArray("cc"),
  /**
   * @type { projectNames: string[]; projectCodes: string[]; completion?: string }[]
   */
  completionRows: jsonb("completion_rows"),
  taskSources: text("task_sources").array(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  // Complex index: CREATE INDEX idx_daily_reports_reporter_date ON daily_reports USING btree (((reporter_id).user_id), report_date DESC),
  index("idx_daily_reports_department_date").on(table.department, table.reportDate),
]);

// table aliases
export const dailyReportsTable = dailyReports;
export const departmentMonthlyReportsTable = departmentMonthlyReports;
export const departmentWeeklyReportsTable = departmentWeeklyReports;
export const feishuUserTokensTable = feishuUserTokens;
export const monthlyReportsTable = monthlyReports;
export const reportDocumentsTable = reportDocuments;
export const scheduledReportSendsTable = scheduledReportSends;
export const taskItemsTable = taskItems;
export const userDepartmentsTable = userDepartments;
export const weeklyReportsTable = weeklyReports;
