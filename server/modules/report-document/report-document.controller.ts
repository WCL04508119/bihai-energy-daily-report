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
import {
  ExportReportDocumentDto,
  ReportDocumentListQueryDto,
} from './dto/export-report-document.dto';

@Controller('api/report-documents')
@NeedLogin()
export class ReportDocumentController {
  constructor(private readonly reportDocumentService: ReportDocumentService) {}

  @Post('export')
  export(@Body() dto: ExportReportDocumentDto): Promise<ReportDocument> {
    return this.reportDocumentService.export(dto);
  }

  @Get()
  list(
    @Query() query: ReportDocumentListQueryDto,
  ): Promise<ReportDocumentListResponse> {
    return this.reportDocumentService.list(query);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    return this.reportDocumentService.remove(id, req.userContext.userId);
  }
}