import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type {
  ReportDocument,
  ReportDocumentListResponse,
} from '@shared/api.interface';
import { ReportDocumentService } from './report-document.service';
import { DataScopeService } from '../data-scope/data-scope.service';
import {
  ExportReportDocumentDto,
  ReportDocumentListQueryDto,
} from './dto/export-report-document.dto';

@Controller('api/report-documents')
@NeedLogin()
export class ReportDocumentController {
  constructor(
    private readonly reportDocumentService: ReportDocumentService,
    private readonly dataScope: DataScopeService,
  ) {}

  @Post('export')
  export(@Body() dto: ExportReportDocumentDto): Promise<ReportDocument> {
    return this.reportDocumentService.export(dto);
  }

  @Get()
  async list(
    @Req() req: Request,
    @Query() query: ReportDocumentListQueryDto,
  ): Promise<ReportDocumentListResponse> {
    const scope = await this.dataScope.resolve(
      req.userContext.roles,
      req.userContext.userId,
    );
    return this.reportDocumentService.list(query, {
      userId: req.userContext.userId,
      canViewAll: scope.kind === 'all',
    });
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    return this.reportDocumentService.remove(id, req.userContext.userId);
  }
}