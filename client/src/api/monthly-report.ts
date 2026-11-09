import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  MonthlyReport,
  MonthlyReportListQuery,
  MonthlyReportListResponse,
  MonthlyTemplateData,
} from '@shared/api.interface';

export function getMonthlyReports(
  query: MonthlyReportListQuery,
): Promise<MonthlyReportListResponse> {
  return axiosForBackend
    .get<MonthlyReportListResponse>('/api/monthly-reports', { params: query })
    .then((r) => r.data);
}

export function getMonthlyReport(id: string): Promise<MonthlyReport> {
  return axiosForBackend
    .get<MonthlyReport>(`/api/monthly-reports/${id}`)
    .then((r) => r.data);
}

interface GenerateMonthlyReportRequest {
  reportMonth: string;
}

export function generateMonthlyReport(
  data: GenerateMonthlyReportRequest,
): Promise<MonthlyReport> {
  return axiosForBackend
    .post<MonthlyReport>('/api/monthly-reports/generate', data)
    .then((r) => r.data);
}

export function updateMonthlyTemplate(
  id: string,
  templateData: MonthlyTemplateData,
): Promise<MonthlyReport> {
  return axiosForBackend
    .patch<MonthlyReport>(`/api/monthly-reports/${id}/template`, {
      templateData,
    })
    .then((r) => r.data);
}
