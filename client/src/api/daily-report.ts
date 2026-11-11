import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  DailyReport,
  DailyReportListQuery,
  DailyReportListResponse,
  CreateDailyReportRequest,
  UpdateDailyReportRequest,
  RecipientDefaults,
} from '@shared/api.interface';

export function getDailyReports(
  query: DailyReportListQuery,
): Promise<DailyReportListResponse> {
  return axiosForBackend
    .get<DailyReportListResponse>('/api/daily-reports', { params: query })
    .then((r) => r.data);
}

export function getDailyReport(id: string): Promise<DailyReport> {
  return axiosForBackend
    .get<DailyReport>(`/api/daily-reports/${id}`)
    .then((r) => r.data);
}

export function getLatestDailyReport(): Promise<DailyReport | null> {
  return axiosForBackend
    .get<DailyReport | null>('/api/daily-reports/latest-mine')
    .then((r) => r.data);
}

export function getRecipientDefaults(
  department?: string,
): Promise<RecipientDefaults> {
  return axiosForBackend
    .get<RecipientDefaults>('/api/daily-reports/recipient-defaults', {
      params: { department },
    })
    .then((r) => r.data);
}

export function createDailyReport(
  data: CreateDailyReportRequest,
): Promise<DailyReport> {
  return axiosForBackend
    .post<DailyReport>('/api/daily-reports', data)
    .then((r) => r.data);
}

export function updateDailyReport(
  id: string,
  data: UpdateDailyReportRequest,
): Promise<DailyReport> {
  return axiosForBackend
    .patch<DailyReport>(`/api/daily-reports/${id}`, data)
    .then((r) => r.data);
}

export function deleteDailyReport(id: string): Promise<{ success: boolean }> {
  return axiosForBackend
    .delete<{ success: boolean }>(`/api/daily-reports/${id}`)
    .then((r) => r.data);
}
