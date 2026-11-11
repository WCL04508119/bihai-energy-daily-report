import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ListChecks, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EnergyHero from '@/components/brand/EnergyHero';
import { UserSelect } from '@/components/business-ui/user-select';
import { UserDisplay } from '@/components/business-ui/user-display';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDataScope } from '@/hooks/use-data-scope';
import { taskPoolApi } from '@/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { resolveAppUrl } from '@lark-apaas/client-toolkit/utils/resolveAppUrl';
import type { TaskItem, TaskPoolSyncResponse } from '@shared/api.interface';

const TASK_POOL_PATH = '/task-pool';
const OAUTH_STATE_KEY = 'bss:feishu-oauth-state';
const OAUTH_REDIRECT_KEY = 'bss:feishu-oauth-redirect';

const TaskPoolPage = () => {
  const { data: scope, isLoading: scopeLoading } = useDataScope();
  const queryClient = useQueryClient();

  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [filterAssigneeId, setFilterAssigneeId] = useState('');

  const [editing, setEditing] = useState<TaskItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleting, setDeleting] = useState<TaskItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['task-pool', filterAssigneeId],
    queryFn: () => taskPoolApi.getTaskPool(filterAssigneeId || undefined),
  });

  const { data: authStatus } = useQuery({
    queryKey: ['feishu-auth-status'],
    queryFn: () => taskPoolApi.getFeishuAuthStatus(),
    staleTime: 60_000,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['task-pool'] });
  };

  const startAuthorization = async (): Promise<void> => {
    const state: string = crypto.randomUUID();
    const redirectUri: string = resolveAppUrl(TASK_POOL_PATH);
    window.sessionStorage.setItem(OAUTH_STATE_KEY, state);
    window.sessionStorage.setItem(OAUTH_REDIRECT_KEY, redirectUri);
    const response = await taskPoolApi.getFeishuAuthUrl(redirectUri, state);
    window.location.assign(response.url);
  };

  const addMutation = useMutation({
    mutationFn: (body: { assigneeId: string; title: string }) =>
      taskPoolApi.createTaskItem(body),
    retry: false,
    onSuccess: () => {
      toast.success('任务已添加');
      setNewTitle('');
      setNewAssigneeId('');
      invalidate();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, '添加任务失败，请稍后重试')),
  });

  const updateMutation = useMutation({
    mutationFn: (body: { id: string; title: string }) =>
      taskPoolApi.updateTaskItem(body.id, { title: body.title }),
    retry: false,
    onSuccess: () => {
      toast.success('任务已更新');
      setEditing(null);
      invalidate();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, '更新任务失败，请稍后重试')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => taskPoolApi.deleteTaskItem(id),
    retry: false,
    onSuccess: () => {
      toast.success('任务已删除');
      setDeleting(null);
      invalidate();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, '删除任务失败，请稍后重试')),
  });

  const syncMutation = useMutation({
    mutationFn: async (): Promise<TaskPoolSyncResponse | null> => {
      const result: TaskPoolSyncResponse = await taskPoolApi.syncFeishuTasks();
      if (result.needAuth) {
        await startAuthorization();
        return null;
      }
      return result;
    },
    retry: false,
    onSuccess: (result: TaskPoolSyncResponse | null) => {
      if (!result) return;
      const scopeText: string =
        result.source === 'personal' ? '你本人名下的飞书任务' : '共享清单任务';
      toast.success(
        `已同步${scopeText}：共 ${result.total} 条，新增 ${result.added}，更新 ${result.updated}`,
      );
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['feishu-auth-status'] });
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, '飞书任务同步失败，请稍后重试')),
  });

  const syncTriggerRef = useRef<() => void>(() => {});
  useEffect(() => {
    syncTriggerRef.current = (): void => syncMutation.mutate();
  }, [syncMutation]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code: string | null = params.get('code');
    if (!code) return;
    const state: string | null = params.get('state');
    const expected: string | null = window.sessionStorage.getItem(OAUTH_STATE_KEY);
    const redirectUri: string =
      window.sessionStorage.getItem(OAUTH_REDIRECT_KEY) ?? resolveAppUrl(TASK_POOL_PATH);
    window.history.replaceState({}, '', window.location.pathname);
    if (expected && state !== expected) {
      toast.error('飞书授权校验未通过，请重新点击同步');
      return;
    }
    taskPoolApi
      .bindFeishuAuth({ code, redirectUri })
      .then(() => {
        toast.success('飞书任务已连接，正在同步...');
        void queryClient.invalidateQueries({ queryKey: ['feishu-auth-status'] });
        syncTriggerRef.current();
      })
      .catch((error: unknown) =>
        toast.error(getApiErrorMessage(error, '飞书授权失败，请稍后重试')),
      );
  }, [queryClient]);

  if (scopeLoading) return <div className="text-slate-500">加载中...</div>;
  const canManage: boolean = scope?.features?.canManageTaskPool === true;

  const addTask = (): void => {
    if (!newAssigneeId) {
      toast.error('请选择归属员工');
      return;
    }
    if (!newTitle.trim()) {
      toast.error('请输入任务名称');
      return;
    }
    addMutation.mutate({ assigneeId: newAssigneeId, title: newTitle.trim() });
  };

  const openEdit = (item: TaskItem): void => {
    setEditing(item);
    setEditTitle(item.title);
  };

  const saveEdit = (): void => {
    if (!editTitle.trim()) {
      toast.error('任务名称不能为空');
      return;
    }
    updateMutation.mutate({ id: editing!.id, title: editTitle.trim() });
  };

  return (
    <div className="space-y-5">
      <EnergyHero
        title="任务池管理"
        description={
          canManage
            ? '预置员工可选的「飞书任务」清单，作为日报任务来源为飞书的选项'
            : '查看任务池中分配给您的飞书任务；如需新增任务请联系部门负责人'
        }
      />

      <p className="text-xs text-slate-500">
        {authStatus?.connected
          ? '已连接飞书任务：点击「同步飞书任务」即可抓取你本人名下的未完成任务。'
          : '首次同步需授权飞书任务（只需一次），点击「同步飞书任务」按提示完成授权。'}
      </p>

      {canManage ? (
        <Card className="animate-fade-up stagger-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
              <Plus className="size-4 text-primary" />
              新增任务
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <label className="text-xs font-medium text-slate-500">归属员工</label>
              <UserSelect
                multiple={false}
                value={newAssigneeId}
                onChange={setNewAssigneeId}
                placeholder="搜索并选择员工"
              />
            </div>
            <div className="min-w-[240px] flex-1 space-y-1.5">
              <label className="text-xs font-medium text-slate-500">任务名称</label>
              <Input
                value={newTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewTitle(e.target.value)
                }
                placeholder="如：完成氢能装置工艺方案设计"
              />
            </div>
            <Button
              className="gap-1.5"
              onClick={addTask}
              disabled={addMutation.isPending}
            >
              <Plus className="size-4" />
              {addMutation.isPending ? '添加中...' : '添加'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="animate-fade-up stagger-2">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <ListChecks className="size-4 text-primary" />
            任务清单
          </CardTitle>
          <div className="w-64">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
              <Search className="size-4 shrink-0 text-slate-400" />
              <UserSelect
                multiple={false}
                value={filterAssigneeId}
                onChange={setFilterAssigneeId}
                placeholder="输入姓名"
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw
              className={syncMutation.isPending ? 'size-4 animate-spin' : 'size-4'}
            />
            {syncMutation.isPending ? '同步中...' : '同步飞书任务'}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-slate-400">加载中...</div>
          ) : data && data.items.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {data.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {item.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-xs text-slate-400">归属：</span>
                      <UserDisplay userId={item.assigneeId} size="small" />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canManage ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`编辑 ${item.title}`}
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`删除 ${item.title}`}
                          className="text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                          onClick={() => setDeleting(item)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-10 text-center text-slate-400">
              {canManage
                ? '暂无任务，请先在“新增任务”中为员工预置任务'
                : '暂无分配给您的任务'}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500">任务名称</label>
            <Input
              value={editTitle}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEditTitle(e.target.value)
              }
              placeholder="请输入任务名称"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setEditing(null)}>
              取消
            </Button>
            <Button
              type="button"
              onClick={saveEdit}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除任务</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除「{deleting?.title}」这条任务吗？删除后员工日报将无法再下拉选到该任务。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TaskPoolPage;