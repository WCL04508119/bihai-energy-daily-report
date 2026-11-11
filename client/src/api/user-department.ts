import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { MyDepartmentInfo } from '@shared/api.interface';

export function getMyDepartment(): Promise<MyDepartmentInfo> {
  return axiosForBackend
    .get<MyDepartmentInfo>('/api/user-departments/mine')
    .then((r) => r.data);
}
