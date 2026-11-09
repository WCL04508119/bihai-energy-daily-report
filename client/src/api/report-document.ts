import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  ExportReportDocumentRequest,
  ReportDocument,
  ReportDocumentListQuery,
  ReportDocumentListResponse,
} from '@shared/api.interface';

export function getReportDocuments(
  query: ReportDocumentListQuery,
): Promise<ReportDocumentListResponse> {
  return axiosForBackend
    .get<ReportDocumentListResponse>('/api/report-documents', {
      params: query,
    })
    .then((r) => r.data);
}

export function exportReportDocument(
  body: ExportReportDocumentRequest,
): Promise<ReportDocument> {
  return axiosForBackend
    .post<ReportDocument>('/api/report-documents/export', body)
    .then((r) => r.data);
}

export function deleteReportDocument(id: string): Promise<{ success: boolean }> {
  return axiosForBackend
    .delete<{ success: boolean }>(`/api/report-documents/${id}`)
    .then((r) => r.data);
}