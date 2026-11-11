import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  ManagerAnalysisContext,
  ManagerDashboardResponse,
  ManagerPeriod,
} from '@shared/api.interface';

export interface ManagerDashboardQuery {
  period: ManagerPeriod;
  anchor?: string;
  department?: string;
}

export function getManagerSummary(
  params: ManagerDashboardQuery,
): Promise<ManagerDashboardResponse> {
  return axiosForBackend
    .get<ManagerDashboardResponse>('/api/manager-dashboard/summary', {
      params,
    })
    .then((response) => response.data);
}

export function getAnalysisContext(
  params: ManagerDashboardQuery,
): Promise<ManagerAnalysisContext> {
  return axiosForBackend
    .get<ManagerAnalysisContext>('/api/manager-dashboard/analysis-context', {
      params,
    })
    .then((response) => response.data);
}
