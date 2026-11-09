import { Module } from '@nestjs/common';
import { ReportDocumentController } from './report-document.controller';
import { ReportDocumentService } from './report-document.service';

@Module({
  controllers: [ReportDocumentController],
  providers: [ReportDocumentService],
})
export class ReportDocumentModule {}