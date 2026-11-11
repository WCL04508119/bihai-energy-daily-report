import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { DataScopeInfo } from '@shared/api.interface';

export function getMyDataScope(): Promise<DataScopeInfo> {
  return axiosForBackend
    .get<DataScopeInfo>('/api/data-scope/me')
    .then((response) => response.data);
}
