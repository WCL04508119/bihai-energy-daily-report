import { BadRequestException, Injectable, Inject, Logger } from '@nestjs/common';
import {
  AuthNPaasService,
  DRIZZLE_DATABASE,
  FileService,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { gte, lte, and, eq, sql } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import { dailyReports } from '../../database/schema';
import type {
  AttendanceEmployee,
  AttendanceExportResult,
  AttendanceStats,
  DepartmentStats,
  SubmissionStats,
} from '@shared/api.interface';

const ATTENDANCE_XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly authNPaasService: AuthNPaasService,
    private readonly fileService: FileService,
  ) {}

  async getSubmissionStats(
    startDate: string,
    endDate: string,
    department?: string,
  ): Promise<SubmissionStats[]> {
    const conditions = [
      gte(dailyReports.reportDate, startDate),
      lte(dailyReports.reportDate, endDate),
    ];
    if (department) {
      conditions.push(eq(dailyReports.department, department));
    }
    const whereClause = and(...conditions);

    // 按日期分组统计：提交人数（去重 reporter_id）、总日报数
    const result = await this.db
      .select({
        date: dailyReports.reportDate,
        submittedUsers: sql<number>`
          count(distinct (${dailyReports.reporterId}).user_id)
        `.as('submitted_users'),
        totalReports: sql<number>`count(*)`.mapWith(Number).as('total_reports'),
      })
      .from(dailyReports)
      .where(whereClause)
      .groupBy(dailyReports.reportDate)
      .orderBy(dailyReports.reportDate);

    // 生成日期范围内每一天的统计，补齐没有数据的日期
    const statsMap = new Map<string, { submittedUsers: number; totalReports: number }>();
    for (const row of result) {
      statsMap.set(String(row.date), {
        submittedUsers: Number(row.submittedUsers),
        totalReports: Number(row.totalReports),
      });
    }

    const dates = this.getDateRange(startDate, endDate);
    const stats: SubmissionStats[] = dates.map((date: string) => {
      const dayData = statsMap.get(date);
      const submittedUsers = dayData?.submittedUsers ?? 0;
      const totalReports = dayData?.totalReports ?? 0;
      // totalUsers 暂按当日提交人数估算（实际应来自用户表，待接入）
      const totalUsers = submittedUsers;
      const submissionRate =
        totalUsers > 0 ? Math.round((submittedUsers / totalUsers) * 10000) / 100 : 0;
      return {
        date,
        totalUsers,
        submittedUsers,
        submissionRate,
        totalReports,
      };
    });

    return stats;
  }

  async getDepartmentStats(
    startDate: string,
    endDate: string,
  ): Promise<DepartmentStats[]> {
    const result = await this.db
      .select({
        department: dailyReports.department,
        submittedUsers: sql<number>`
          count(distinct (${dailyReports.reporterId}).user_id)
        `.as('submitted_users'),
        totalReports: sql<number>`count(*)`.mapWith(Number).as('total_reports'),
      })
      .from(dailyReports)
      .where(
        and(
          gte(dailyReports.reportDate, startDate),
          lte(dailyReports.reportDate, endDate),
        ),
      )
      .groupBy(dailyReports.department)
      .orderBy(dailyReports.department);

    const stats: DepartmentStats[] = result.map((row) => {
      const submittedUsers = Number(row.submittedUsers);
      // totalUsers 暂按提交人数估算（实际应来自用户表）
      const totalUsers = submittedUsers;
      const submissionRate =
        totalUsers > 0
          ? Math.round((submittedUsers / totalUsers) * 10000) / 100
          : 0;
      return {
        department: row.department as DepartmentStats['department'],
        totalUsers,
        submittedUsers,
        submissionRate,
      };
    });

    return stats;
  }

  /**
   * 按人员 × 每月工作日核对：谁在工作日没提交日报。
   * 工作日口径：周一至周五（不含周末），无节假日历（法定节假日按工作日统计）。
   * 人员名单 = 日报表里所有曾提交过的 reporter，用于识别某月有缺交的人员。
   */
  async getAttendance(month: string): Promise<AttendanceStats> {
    const validated = this.validateMonth(month);
    const workingDays = this.getWorkingDays(validated);

    // 全员名单：日报表所有去重 reporter
    const reporters = await this.db
      .selectDistinct({
        userId: sql<string>`(${dailyReports.reporterId}).user_id`,
      })
      .from(dailyReports);
    const userIds = reporters.map((r) => r.userId);

    // 当月提交情况
    const [y, m] = validated.split('-').map(Number);
    const lastDayOfMonth = new Date(y, m, 0).getDate();
    const monthFirst = `${validated}-01`;
    const monthLast = `${validated}-${String(lastDayOfMonth).padStart(2, '0')}`;
    const rows = await this.db
      .select({
        date: dailyReports.reportDate,
        reporterId: dailyReports.reporterId,
      })
      .from(dailyReports)
      .where(
        and(
          gte(dailyReports.reportDate, monthFirst),
          lte(dailyReports.reportDate, monthLast),
        ),
      );

    const dayMap = new Map<string, Set<string>>();
    for (const row of rows) {
      const d = String(row.date);
      const uid = String(row.reporterId);
      if (!dayMap.has(d)) dayMap.set(d, new Set());
      dayMap.get(d)!.add(uid);
    }

    const nameMap = await this.resolveNames(userIds);
    const employees: AttendanceEmployee[] = userIds.map((userId) => {
      let submittedDays = 0;
      const days: Record<string, boolean> = {};
      for (const day of workingDays) {
        const submitted = dayMap.get(day)?.has(userId) ?? false;
        days[day] = submitted;
        if (submitted) submittedDays += 1;
      }
      return {
        userId,
        name: nameMap.get(userId) ?? userId,
        submittedDays,
        missingDays: workingDays.length - submittedDays,
        days,
      };
    });
    employees.sort(
      (a, b) =>
        b.missingDays - a.missingDays || a.name.localeCompare(b.name, 'zh-CN'),
    );

    return { month: validated, workingDays, employees };
  }

  async exportAttendance(month: string): Promise<AttendanceExportResult> {
    const stats = await this.getAttendance(month);
    const buffer = this.buildAttendanceXlsx(stats);
    const fileName = `日报提交核对_${stats.month}.xlsx`;
    try {
      const uploaded = await this.fileService.upload(buffer, {
        fileName,
        contentType: ATTENDANCE_XLSX_CONTENT_TYPE,
      });
      return { fileName, downloadUrl: uploaded.downloadURL };
    } catch (error) {
      this.logger.error(
        '出勤核对 Excel 上传失败',
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('出勤核对文件生成失败，请稍后重试');
    }
  }

  private validateMonth(month: string): string {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new BadRequestException('月份格式不正确，应为 YYYY-MM');
    }
    return month;
  }

  private getWorkingDays(month: string): string[] {
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const days: string[] = [];
    for (let d = 1; d <= lastDay; d += 1) {
      const weekday = new Date(y, m - 1, d).getDay();
      if (weekday !== 0 && weekday !== 6) {
        days.push(`${month}-${String(d).padStart(2, '0')}`);
      }
    }
    return days;
  }

  private async resolveNames(userIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (userIds.length === 0) return map;
    try {
      const infos = await this.authNPaasService.listUsersByIds(userIds);
      infos.forEach((info, i) => {
        if (!info) return;
        const name = info.name?.zh_cn ?? info.name?.en_us ?? '';
        if (name) map.set(userIds[i], name);
      });
    } catch (error) {
      this.logger.warn(
        '出勤名单姓名解析失败，将用用户ID展示',
        error instanceof Error ? error.stack : String(error),
      );
    }
    return map;
  }

  private buildAttendanceXlsx(stats: AttendanceStats): Buffer {
    const header = [
      '员工',
      '提交天数',
      '缺交天数',
      ...stats.workingDays.map((d) => d.slice(5)),
    ];
    const aoa: (string | number)[][] = [header];
    for (const e of stats.employees) {
      aoa.push([
        e.name,
        e.submittedDays,
        e.missingDays,
        ...stats.workingDays.map((d) => (e.days[d] ? '✓' : '✗')),
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 10 },
      { wch: 10 },
      ...stats.workingDays.map(() => ({ wch: 6 })),
    ];
    ws['!freeze'] = { xSplit: 1, ySplit: 1 };

    // 表头加粗
    stats.workingDays.forEach((_, ci) => {
      const addr = XLSX.utils.encode_cell({ r: 0, c: ci + 3 });
      if (ws[addr]) ws[addr].s = { ...(ws[addr].s ?? {}), font: { bold: true } };
    });
    // 按日状态着色：缺交红、已交绿
    stats.workingDays.forEach((day, ci) => {
      const col = ci + 3;
      stats.employees.forEach((e, ri) => {
        const addr = XLSX.utils.encode_cell({ r: ri + 1, c: col });
        if (!ws[addr]) ws[addr] = { t: 's', v: '' };
        ws[addr].s = {
          fill: e.days[day]
            ? { fgColor: { rgb: 'E7F6EC' } }
            : { fgColor: { rgb: 'FDE8E8' } },
          alignment: { horizontal: 'center' },
        };
      });
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '月度提交核对');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  private getDateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');

    const current = new Date(startDate);
    while (current <= endDate) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }
}
