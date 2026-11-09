import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  FileService,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { and, count, desc, eq } from 'drizzle-orm';
import {
  departmentMonthlyReports,
  departmentWeeklyReports,
  monthlyReports,
  reportDocuments,
  weeklyReports,
} from '../../database/schema';
import {
  isReportDocumentType,
  parseMonthlyTemplateData,
  parseWeeklyTemplateData,
  type ReportDocument,
  type ReportDocumentListResponse,
  type ReportDocumentType,
} from '@shared/api.interface';
import { buildReportDocx, type ReportDocSource } from './report-document-docx';
import {
  ExportReportDocumentDto,
  ReportDocumentListQueryDto,
} from './dto/export-report-document.dto';

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type ReportDocumentRow = typeof reportDocuments.$inferSelect;

@Injectable()
export class ReportDocumentService {
  private readonly logger = new Logger(ReportDocumentService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly fileService: FileService,
  ) {}

  async export(dto: ExportReportDocumentDto): Promise<ReportDocument> {
    const source = await this.resolveSource(dto.reportType, dto.reportId);
    const buffer = await buildReportDocx(source);
    const fileName = `${source.title}.docx`;

    let fileMeta: {
      filePath: string;
      downloadURL: string;
    };
    try {
      const uploaded = await this.fileService.upload(buffer, {
        fileName,
        contentType: DOCX_CONTENT_TYPE,
      });
      fileMeta = {
        filePath: uploaded.filePath,
        downloadURL: uploaded.downloadURL,
      };
    } catch (error) {
      this.logger.error(
        '报告导出文件上传失败',
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('导出文件保存失败，请稍后重试');
    }

    const [inserted] = await this.db
      .insert(reportDocuments)
      .values({
        reportType: dto.reportType,
        reportId: dto.reportId,
        title: source.title,
        fileName,
        filePath: fileMeta.filePath,
        downloadUrl: fileMeta.downloadURL,
      })
      .returning();

    return this.toReportDocument(inserted);
  }

  async list(
    query: ReportDocumentListQueryDto,
  ): Promise<ReportDocumentListResponse> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);

    const conditions = [];
    if (
      query.reportType &&
      query.reportType !== 'all' &&
      isReportDocumentType(query.reportType)
    ) {
      conditions.push(eq(reportDocuments.reportType, query.reportType));
    }
    const where =
      conditions.length > 0 ? and(...conditions) : undefined;

    const items = await (where
      ? this.db
          .select()
          .from(reportDocuments)
          .where(where)
          .orderBy(desc(reportDocuments.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize)
      : this.db
          .select()
          .from(reportDocuments)
          .orderBy(desc(reportDocuments.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize));

    const [{ total }] = where
      ? await this.db
          .select({ total: count() })
          .from(reportDocuments)
          .where(where)
      : await this.db.select({ total: count() }).from(reportDocuments);

    return {
      items: items.map((row: ReportDocumentRow) => this.toReportDocument(row)),
      total,
      page,
      pageSize,
    };
  }

  async remove(id: string, userId: string): Promise<{ success: boolean }> {
    const existing = await this.db
      .select()
      .from(reportDocuments)
      .where(eq(reportDocuments.id, id));
    const doc = existing[0];
    if (!doc) throw new NotFoundException('归档记录不存在');
    if (doc.createdBy !== userId) {
      throw new ForbiddenException('只能删除自己导出的报告');
    }

    await this.fileService
      .remove([doc.downloadUrl])
      .catch((error: unknown) => {
        this.logger.warn(
          '归档文件删除失败，仅删除本地记录',
          error instanceof Error ? error.stack : String(error),
        );
      });

    const deleted = await this.db
      .delete(reportDocuments)
      .where(eq(reportDocuments.id, id))
      .returning({ id: reportDocuments.id });
    if (deleted.length === 0) throw new NotFoundException('归档记录不存在');
    return { success: true };
  }

  private async resolveSource(
    reportType: ReportDocumentType,
    reportId: string,
  ): Promise<ReportDocSource> {
    if (reportType === 'weekly') {
      const [row] = await this.db
        .select()
        .from(weeklyReports)
        .where(eq(weeklyReports.id, reportId));
      if (!row) throw new NotFoundException('周报不存在');
      return {
        title: `周报_${row.department}_${row.weekStart}_${row.weekEnd}`,
        reportType,
        department: row.department,
        period: `${row.weekStart} 至 ${row.weekEnd}`,
        reportCount: row.reportCount,
        totalWorkHours: Number(row.totalWorkHours),
        completionRate: Number(row.completionRate),
        summaryContent: row.summaryContent ?? undefined,
        templateData: parseWeeklyTemplateData(row.templateData),
      };
    }
    if (reportType === 'monthly') {
      const [row] = await this.db
        .select()
        .from(monthlyReports)
        .where(eq(monthlyReports.id, reportId));
      if (!row) throw new NotFoundException('月报不存在');
      return {
        title: `月报_${row.department}_${row.reportMonth}`,
        reportType,
        department: row.department,
        period: row.reportMonth,
        reportCount: row.reportCount,
        totalWorkHours: Number(row.totalWorkHours),
        completionRate: Number(row.completionRate),
        summaryContent: row.summaryContent ?? undefined,
        templateData: parseMonthlyTemplateData(row.templateData),
      };
    }
    if (reportType === 'department-weekly') {
      const [row] = await this.db
        .select()
        .from(departmentWeeklyReports)
        .where(eq(departmentWeeklyReports.id, reportId));
      if (!row) throw new NotFoundException('部门周报不存在');
      return {
        title: `部门周报_${row.department}_${row.weekStart}_${row.weekEnd}`,
        reportType,
        department: row.department,
        period: `${row.weekStart} 至 ${row.weekEnd}`,
        reportCount: row.reportCount,
        totalWorkHours: Number(row.totalWorkHours),
        completionRate: Number(row.completionRate),
        issueCount: row.issueCount,
        summaryContent: row.summaryContent ?? undefined,
        issuesSummary: row.issuesSummary ?? undefined,
        templateData: parseWeeklyTemplateData(row.templateData),
      };
    }
    const [row] = await this.db
      .select()
      .from(departmentMonthlyReports)
      .where(eq(departmentMonthlyReports.id, reportId));
    if (!row) throw new NotFoundException('部门月报不存在');
    return {
      title: `部门月报_${row.department}_${row.reportMonth}`,
      reportType,
      department: row.department,
      period: row.reportMonth,
      reportCount: row.reportCount,
      totalWorkHours: Number(row.totalWorkHours),
      completionRate: Number(row.completionRate),
      issueCount: row.issueCount,
      summaryContent: row.summaryContent ?? undefined,
      issuesSummary: row.issuesSummary ?? undefined,
      templateData: parseMonthlyTemplateData(row.templateData),
    };
  }

  private toReportDocument(row: ReportDocumentRow): ReportDocument {
    const reportType = isReportDocumentType(row.reportType)
      ? row.reportType
      : 'weekly';
    return {
      id: row.id,
      reportType,
      reportId: row.reportId,
      title: row.title,
      fileName: row.fileName,
      downloadUrl: row.downloadUrl,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}