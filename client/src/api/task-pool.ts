import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  TaskItem,
  TaskItemListResponse,
  CreateTaskItemRequest,
  UpdateTaskItemRequest,
  DeleteResponse,
  TaskPoolSyncResponse,
  FeishuAuthBindRequest,
  FeishuAuthStatusResponse,
  FeishuAuthUrlResponse,
} from '@shared/api.interface';

export const getMyTaskPool = (): Promise<TaskItemListResponse> =>
  axiosForBackend.get('/api/task-pool/mine').then((r: { data: TaskItemListResponse }) => r.data);

export const getTaskPool = (assigneeId?: string): Promise<TaskItemListResponse> =>
  axiosForBackend
    .get('/api/task-pool', { params: assigneeId ? { assigneeId } : {} })
    .then((r: { data: TaskItemListResponse }) => r.data);

export const createTaskItem = (body: CreateTaskItemRequest): Promise<TaskItem> =>
  axiosForBackend.post('/api/task-pool', body).then((r: { data: TaskItem }) => r.data);

export const updateTaskItem = (
  id: string,
  body: UpdateTaskItemRequest,
): Promise<TaskItem> =>
  axiosForBackend
    .patch(`/api/task-pool/${id}`, body)
    .then((r: { data: TaskItem }) => r.data);

export const deleteTaskItem = (id: string): Promise<DeleteResponse> =>
  axiosForBackend
    .delete(`/api/task-pool/${id}`)
    .then((r: { data: DeleteResponse }) => r.data);

export const syncFeishuTasks = (): Promise<TaskPoolSyncResponse> =>
  axiosForBackend
    .post('/api/feishu-task-sync/sync')
    .then((r: { data: TaskPoolSyncResponse }) => r.data);

export const getFeishuAuthUrl = (
  redirectUri: string,
  state: string,
): Promise<FeishuAuthUrlResponse> =>
  axiosForBackend
    .get('/api/feishu-task-sync/auth-url', { params: { redirectUri, state } })
    .then((r: { data: FeishuAuthUrlResponse }) => r.data);

export const bindFeishuAuth = (
  body: FeishuAuthBindRequest,
): Promise<FeishuAuthStatusResponse> =>
  axiosForBackend
    .post('/api/feishu-task-sync/oauth-bind', body)
    .then((r: { data: FeishuAuthStatusResponse }) => r.data);

export const getFeishuAuthStatus = (): Promise<FeishuAuthStatusResponse> =>
  axiosForBackend
    .get('/api/feishu-task-sync/auth-status')
    .then((r: { data: FeishuAuthStatusResponse }) => r.data);
