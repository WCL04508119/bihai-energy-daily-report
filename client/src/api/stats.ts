import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  SubmissionStats,
  DepartmentStats,
  AttendanceStats,
  AttendanceExportResult,
} from '@shared/api.interface';

export interface StatsQueryParams {
  startDate?: string;
  endDate?: string;
  department?: string;
}

export function getSubmissionStats(
  params: StatsQueryParams,
): Promise<SubmissionStats[]> {
  return axiosForBackend
    .get<SubmissionStats[]>('/api/stats/submission', { params })
    .then((r) => r.data);
}

export function getDepartmentStats(
  params: StatsQueryParams,
): Promise<DepartmentStats[]> {
  return axiosForBackend
    .get<DepartmentStats[]>('/api/stats/department', { params })
    .then((r) => r.data);
}

export function getAttendance(month: string): Promise<AttendanceStats> {
  return axiosForBackend
    .get<AttendanceStats>('/api/stats/attendance', { params: { month } })
    .then((r) => r.data);
}

export function exportAttendance(
  month: string,
): Promise<AttendanceExportResult> {
  return axiosForBackend
    .post<AttendanceExportResult>('/api/stats/attendance/export', { month })
    .then((r) => r.data);
}
