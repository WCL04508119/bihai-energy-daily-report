import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  WeeklyReport,
  WeeklyReportListQuery,
  WeeklyReportListResponse,
  WeeklyTemplateData,
} from '@shared/api.interface';

export function getWeeklyReports(
  query: WeeklyReportListQuery,
): Promise<WeeklyReportListResponse> {
  return axiosForBackend
    .get<WeeklyReportListResponse>('/api/weekly-reports', { params: query })
    .then((r) => r.data);
}

export function getWeeklyReport(id: string): Promise<WeeklyReport> {
  return axiosForBackend
    .get<WeeklyReport>(`/api/weekly-reports/${id}`)
    .then((r) => r.data);
}

interface GenerateWeeklyReportRequest {
  weekStart: string;
}

export function generateWeeklyReport(
  data: GenerateWeeklyReportRequest,
): Promise<WeeklyReport> {
  return axiosForBackend
    .post<WeeklyReport>('/api/weekly-reports/generate', data)
    .then((r) => r.data);
}

export function updateWeeklyTemplate(
  id: string,
  templateData: WeeklyTemplateData,
): Promise<WeeklyReport> {
  return axiosForBackend
    .patch<WeeklyReport>(`/api/weekly-reports/${id}/template`, { templateData })
    .then((r) => r.data);
}
