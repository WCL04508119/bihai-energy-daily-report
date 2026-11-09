import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

import { getApiErrorMessage } from '@/lib/api-error';
import type {
  CreateDepartmentMonthlyReportRequest,
  CreateDepartmentWeeklyReportRequest,
  DepartmentMonthlyReport,
  DepartmentMonthlyReportDetail,
  DepartmentMonthlyReportListQuery,
  DepartmentMonthlyReportListResponse,
  DepartmentWeeklyReport,
  DepartmentWeeklyReportDetail,
  DepartmentWeeklyReportListQuery,
  DepartmentWeeklyReportListResponse,
  WeeklyTemplateData,
  MonthlyTemplateData,
} from '@shared/api.interface';

export const DEPARTMENT_REPORT_FORBIDDEN_MESSAGE =
  '仅室主任可生成或管理部门报告，请联系管理员开通权限';

export class DepartmentReportForbiddenError extends Error {
  constructor(message: string = DEPARTMENT_REPORT_FORBIDDEN_MESSAGE) {
    super(message);
    this.name = 'DepartmentReportForbiddenError';
  }
}

const BASE_PATH = '/api/department-report';

export function describeDepartmentReportError(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof DepartmentReportForbiddenError) return error.message;
  return getApiErrorMessage(error, fallback);
}

const getResponseStatus = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  const response = (error as { response?: { status?: number } }).response;
  return response?.status;
};

const getRequestUrl = (error: unknown): string => {
  if (typeof error !== 'object' || error === null) return '';
  const config = (error as { config?: { url?: string } }).config;
  return config?.url ?? '';
};

axiosForBackend.interceptors.response.use(
  (response) => {
    if (
      response.status === 403 &&
      String(response.config?.url ?? '').includes(BASE_PATH)
    ) {
      return Promise.reject(new DepartmentReportForbiddenError());
    }
    return response;
  },
  (error: unknown) => {
    const status = getResponseStatus(error);
    if (status === 403 && getRequestUrl(error).includes(BASE_PATH)) {
      return Promise.reject(new DepartmentReportForbiddenError());
    }
    return Promise.reject(error);
  },
);

export function getDepartmentWeeklyReports(
  query: DepartmentWeeklyReportListQuery,
): Promise<DepartmentWeeklyReportListResponse> {
  return axiosForBackend
    .get<DepartmentWeeklyReportListResponse>(`${BASE_PATH}/weekly`, {
      params: query,
    })
    .then((r) => r.data);
}

export function getDepartmentWeeklyReport(
  id: string,
): Promise<DepartmentWeeklyReportDetail> {
  return axiosForBackend
    .get<DepartmentWeeklyReportDetail>(`${BASE_PATH}/weekly/${id}`)
    .then((r) => r.data);
}

export function createDepartmentWeeklyReport(
  data: CreateDepartmentWeeklyReportRequest,
): Promise<DepartmentWeeklyReport> {
  return axiosForBackend
    .post<DepartmentWeeklyReport>(`${BASE_PATH}/weekly`, data)
    .then((r) => r.data);
}

export function updateDepartmentWeeklyTemplate(
  id: string,
  templateData: WeeklyTemplateData,
): Promise<DepartmentWeeklyReport> {
  return axiosForBackend
    .patch<DepartmentWeeklyReport>(`${BASE_PATH}/weekly/${id}/template`, {
      templateData,
    })
    .then((r) => r.data);
}

export function deleteDepartmentWeeklyReport(
  id: string,
): Promise<{ success: boolean }> {
  return axiosForBackend
    .delete<{ success: boolean }>(`${BASE_PATH}/weekly/${id}`)
    .then((r) => r.data);
}

export function getDepartmentMonthlyReports(
  query: DepartmentMonthlyReportListQuery,
): Promise<DepartmentMonthlyReportListResponse> {
  return axiosForBackend
    .get<DepartmentMonthlyReportListResponse>(`${BASE_PATH}/monthly`, {
      params: query,
    })
    .then((r) => r.data);
}

export function getDepartmentMonthlyReport(
  id: string,
): Promise<DepartmentMonthlyReportDetail> {
  return axiosForBackend
    .get<DepartmentMonthlyReportDetail>(`${BASE_PATH}/monthly/${id}`)
    .then((r) => r.data);
}

export function createDepartmentMonthlyReport(
  data: CreateDepartmentMonthlyReportRequest,
): Promise<DepartmentMonthlyReport> {
  return axiosForBackend
    .post<DepartmentMonthlyReport>(`${BASE_PATH}/monthly`, data)
    .then((r) => r.data);
}

export function updateDepartmentMonthlyTemplate(
  id: string,
  templateData: MonthlyTemplateData,
): Promise<DepartmentMonthlyReport> {
  return axiosForBackend
    .patch<DepartmentMonthlyReport>(`${BASE_PATH}/monthly/${id}/template`, {
      templateData,
    })
    .then((r) => r.data);
}

export function deleteDepartmentMonthlyReport(
  id: string,
): Promise<{ success: boolean }> {
  return axiosForBackend
    .delete<{ success: boolean }>(`${BASE_PATH}/monthly/${id}`)
    .then((r) => r.data);
}
