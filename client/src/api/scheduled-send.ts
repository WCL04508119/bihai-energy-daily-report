import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  CreateScheduledSendRequest,
  ScheduledReportSend,
  ScheduledSendListResponse,
} from '@shared/api.interface';

export function createScheduledSend(
  data: CreateScheduledSendRequest,
): Promise<ScheduledReportSend> {
  return axiosForBackend
    .post('/api/scheduled-report-sends', data)
    .then((r) => r.data);
}

export function getMyScheduledSends(): Promise<ScheduledSendListResponse> {
  return axiosForBackend
    .get('/api/scheduled-report-sends/mine')
    .then((r) => r.data);
}

export function cancelScheduledSend(
  id: string,
): Promise<{ success: boolean }> {
  return axiosForBackend
    .delete(`/api/scheduled-report-sends/${id}`)
    .then((r) => r.data);
}
