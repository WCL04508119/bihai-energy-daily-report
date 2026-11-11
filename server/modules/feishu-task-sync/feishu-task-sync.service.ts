import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
  AuthNPaasService,
} from '@lark-apaas/fullstack-nestjs-core';
import { eq, inArray } from 'drizzle-orm';

import { feishuUserTokens, taskItems } from '../../database/schema';
import { FeishuService } from '../feishu/feishu.service';
import type {
  FeishuAuthStatusResponse,
  TaskPoolSyncResponse,
} from '@shared/api.interface';

const TASKLIST_NAME = '日报任务池';
const FEISHU_OPEN_BASE = 'https://open.feishu.cn/open-apis';
const OAUTH_SCOPE = 'task:task:read offline_access';
const TOKEN_REFRESH_AHEAD_MS = 2 * 60 * 1000;

interface TasklistItem {
  guid: string;
  name: string;
}

interface FeishuTaskMember {
  id: string;
  type?: string;
  role?: string;
}

interface FeishuTask {
  guid: string;
  summary: string;
  completed?: boolean;
  members?: FeishuTaskMember[];
}

interface SyncCandidate {
  externalId: string;
  assignee: string;
  title: string;
}

interface FeishuOAuthTokenPayload {
  code?: number;
  error?: string;
  error_description?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

interface FeishuUserInfoPayload {
  code?: number;
  msg?: string;
  data?: { open_id?: string };
}

interface FeishuMyTaskListPayload {
  code?: number;
  msg?: string;
  data?: { items?: FeishuTask[]; has_more?: boolean; page_token?: string };
}

@Injectable()
export class FeishuTaskSyncService {
  private readonly logger = new Logger(FeishuTaskSyncService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly feishuService: FeishuService,
    private readonly authNPaasService: AuthNPaasService,
  ) {}

  buildAuthUrl(redirectUri: string, state: string): string {
    const query: string = new URLSearchParams({
      app_id: this.feishuService.getAppId(),
      redirect_uri: redirectUri,
      scope: OAUTH_SCOPE,
      state,
    }).toString();
    return `${FEISHU_OPEN_BASE}/authen/v1/authorize?${query}`;
  }

  async bindAuthorization(
    userId: string,
    code: string,
    redirectUri: string,
  ): Promise<FeishuAuthStatusResponse> {
    const payload: FeishuOAuthTokenPayload = await this.requestUserToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
    const accessToken: string = payload.access_token as string;
    const openId: string | null = await this.fetchOpenId(accessToken);
    const expiresAt: Date = new Date(
      Date.now() + (payload.expires_in ?? 7200) * 1000,
    );
    await this.db
      .insert(feishuUserTokens)
      .values({
        userId,
        openId,
        accessToken,
        refreshToken: payload.refresh_token ?? '',
        expiresAt,
        scope: payload.scope ?? OAUTH_SCOPE,
      })
      .onConflictDoUpdate({
        target: feishuUserTokens.userId,
        set: {
          openId,
          accessToken,
          refreshToken: payload.refresh_token ?? '',
          expiresAt,
          scope: payload.scope ?? OAUTH_SCOPE,
          updatedAt: new Date(),
        },
      });
    this.logger.log(`飞书任务授权绑定成功 user=${userId}`);
    return { connected: true, expiresAt: expiresAt.toISOString() };
  }

  async getAuthStatus(userId: string): Promise<FeishuAuthStatusResponse> {
    const rows = await this.db
      .select({
        expiresAt: feishuUserTokens.expiresAt,
      })
      .from(feishuUserTokens)
      .where(eq(feishuUserTokens.userId, userId))
      .limit(1);
    if (rows.length === 0) return { connected: false, expiresAt: null };
    const expiresAt: Date = rows[0].expiresAt;
    return {
      connected: expiresAt.getTime() > Date.now(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async sync(userId: string, isManager: boolean): Promise<TaskPoolSyncResponse> {
    const token = await this.getValidToken(userId);
    if (token) {
      const items: FeishuTask[] = await this.listMyTasks(token.accessToken);
      const candidates: SyncCandidate[] = items
        .filter((task: FeishuTask) => !task.completed && Boolean(task.guid))
        .map((task: FeishuTask) => ({
          externalId: task.guid,
          assignee: userId,
          title: task.summary || '飞书任务',
        }));
      const counters = await this.upsertCandidates(candidates);
      this.logger.log(
        `飞书个人任务同步完成 user=${userId}，共 ${items.length} 条，新增 ${counters.added}，更新 ${counters.updated}`,
      );
      return this.buildResponse('personal', {
        total: items.length,
        added: counters.added,
        updated: counters.updated,
      });
    }

    if (isManager) {
      return this.syncSharedTasklist();
    }

    return this.buildResponse('personal', { needAuth: true });
  }

  async syncAllAuthorized(): Promise<void> {
    const rows = await this.db
      .select({ userId: feishuUserTokens.userId })
      .from(feishuUserTokens);
    if (rows.length === 0) {
      this.logger.log('飞书任务定时同步：暂无已授权员工，跳过');
      return;
    }
    for (const row of rows) {
      try {
        await this.sync(row.userId, false);
      } catch (error) {
        this.logger.warn(
          `飞书任务定时同步失败 user=${row.userId}：${(error as Error).message}`,
        );
      }
    }
  }

  private buildResponse(
    source: 'personal' | 'shared',
    override: Partial<TaskPoolSyncResponse>,
  ): TaskPoolSyncResponse {
    return {
      listGuid: '',
      total: 0,
      added: 0,
      updated: 0,
      skippedNoAssignee: 0,
      convertedFailed: 0,
      source,
      needAuth: false,
      ...override,
    };
  }

  private async requestUserToken(
    body: Record<string, string>,
  ): Promise<FeishuOAuthTokenPayload> {
    const response = await fetch(`${FEISHU_OPEN_BASE}/authen/v2/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        client_id: this.feishuService.getAppId(),
        client_secret: this.feishuService.getAppSecret(),
        ...body,
      }),
    });
    const payload = (await response.json()) as FeishuOAuthTokenPayload;
    if (!response.ok || payload.error || !payload.access_token) {
      const reason: string =
        payload.error_description ?? payload.error ?? String(response.status);
      throw new Error(`飞书授权失败：${reason}`);
    }
    return payload;
  }

  private async fetchOpenId(accessToken: string): Promise<string | null> {
    const response = await fetch(`${FEISHU_OPEN_BASE}/authen/v1/user_info`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as FeishuUserInfoPayload;
    return payload.data?.open_id ?? null;
  }

  private async getValidToken(
    userId: string,
  ): Promise<{ accessToken: string } | null> {
    const rows = await this.db
      .select()
      .from(feishuUserTokens)
      .where(eq(feishuUserTokens.userId, userId))
      .limit(1);
    if (rows.length === 0) return null;
    const row = rows[0];
    if (row.expiresAt.getTime() - TOKEN_REFRESH_AHEAD_MS > Date.now()) {
      return { accessToken: row.accessToken };
    }
    if (!row.refreshToken) return null;
    try {
      const payload: FeishuOAuthTokenPayload = await this.requestUserToken({
        grant_type: 'refresh_token',
        refresh_token: row.refreshToken,
      });
      const expiresAt: Date = new Date(
        Date.now() + (payload.expires_in ?? 7200) * 1000,
      );
      await this.db
        .update(feishuUserTokens)
        .set({
          accessToken: payload.access_token as string,
          refreshToken: payload.refresh_token ?? row.refreshToken,
          expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(feishuUserTokens.userId, userId));
      return { accessToken: payload.access_token as string };
    } catch (error) {
      this.logger.warn(
        `飞书令牌刷新失败，需重新授权 user=${userId}：${(error as Error).message}`,
      );
      return null;
    }
  }

  private async listMyTasks(accessToken: string): Promise<FeishuTask[]> {
    const tasks: FeishuTask[] = [];
    let pageToken = '';
    do {
      const query: string = new URLSearchParams({
        page_size: '100',
        type: 'my_tasks',
        completed: 'false',
        user_id_type: 'open_id',
        ...(pageToken ? { page_token: pageToken } : {}),
      }).toString();
      const response = await fetch(`${FEISHU_OPEN_BASE}/task/v2/tasks?${query}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json()) as FeishuMyTaskListPayload;
      if (!response.ok || (payload.code ?? 0) !== 0) {
        throw new Error(
          `获取飞书任务失败 [${payload.code ?? response.status}]: ${payload.msg ?? ''}`,
        );
      }
      tasks.push(...(payload.data?.items ?? []));
      pageToken = payload.data?.has_more ? payload.data?.page_token ?? '' : '';
    } while (pageToken);
    return tasks;
  }

  private async upsertCandidates(
    candidates: SyncCandidate[],
  ): Promise<{ added: number; updated: number }> {
    let added = 0;
    let updated = 0;
    if (candidates.length === 0) return { added, updated };
    const existingRows = await this.db
      .select({ id: taskItems.id, externalId: taskItems.externalId })
      .from(taskItems)
      .where(
        inArray(
          taskItems.externalId,
          candidates.map((candidate: SyncCandidate) => candidate.externalId),
        ),
      );
    const existingByExternal = new Map<string, string>();
    for (const row of existingRows) {
      if (row.externalId) existingByExternal.set(row.externalId, row.id);
    }
    for (const candidate of candidates) {
      const currentId: string | undefined = existingByExternal.get(
        candidate.externalId,
      );
      if (currentId) {
        await this.db
          .update(taskItems)
          .set({ assignee: candidate.assignee, title: candidate.title })
          .where(eq(taskItems.id, currentId));
        updated += 1;
      } else {
        await this.db.insert(taskItems).values({
          assignee: candidate.assignee,
          title: candidate.title,
          externalId: candidate.externalId,
        });
        added += 1;
      }
    }
    return { added, updated };
  }

  private async listTasklists(): Promise<TasklistItem[]> {
    const client = this.feishuService.getClient();
    const res = await client.request<{
      code: number;
      msg?: string;
      data?: { items?: TasklistItem[] };
    }>({
      method: 'GET',
      url: '/open-apis/task/v2/tasklists',
      params: { page_size: 100 },
    });
    if (res.code !== 0) {
      throw new Error(`获取任务清单失败 [${res.code}]: ${res.msg ?? ''}`);
    }
    return res.data?.items ?? [];
  }

  private async createTasklist(name: string): Promise<string> {
    const client = this.feishuService.getClient();
    const res = await client.request<{
      code: number;
      msg?: string;
      data?: { tasklist?: { guid?: string } };
    }>({
      method: 'POST',
      url: '/open-apis/task/v2/tasklists',
      data: { name },
    });
    if (res.code !== 0) {
      throw new Error(`创建任务清单失败 [${res.code}]: ${res.msg ?? ''}`);
    }
    const guid = res.data?.tasklist?.guid;
    if (!guid) {
      throw new Error('创建任务清单未返回 guid');
    }
    return guid;
  }

  async ensureTasklist(): Promise<string> {
    const existing = await this.listTasklists();
    const hit = existing.find((item) => item.name === TASKLIST_NAME);
    if (hit?.guid) return hit.guid;
    this.logger.log(`未找到共享任务清单「${TASKLIST_NAME}」，正在创建`);
    return this.createTasklist(TASKLIST_NAME);
  }

  private async listTasksInTasklist(
    tasklistGuid: string,
  ): Promise<FeishuTask[]> {
    const client = this.feishuService.getClient();
    const tasks: FeishuTask[] = [];
    let pageToken = '';
    do {
      const params: Record<string, string | number> = {
        page_size: 100,
        user_id_type: 'open_id',
      };
      if (pageToken) params.page_token = pageToken;
      const res = await client.request<{
        code: number;
        msg?: string;
        data?: {
          items?: FeishuTask[];
          has_more?: boolean;
          page_token?: string;
        };
      }>({
        method: 'GET',
        url: `/open-apis/task/v2/tasklists/${tasklistGuid}/tasks`,
        params,
      });
      if (res.code !== 0) {
        throw new Error(`获取清单任务失败 [${res.code}]: ${res.msg ?? ''}`);
      }
      tasks.push(...(res.data?.items ?? []));
      pageToken = res.data?.has_more ? res.data?.page_token ?? '' : '';
    } while (pageToken);
    return tasks;
  }

  private async syncSharedTasklist(): Promise<TaskPoolSyncResponse> {
    const listGuid: string = await this.ensureTasklist();
    const tasks: FeishuTask[] = await this.listTasksInTasklist(listGuid);
    const candidates: SyncCandidate[] = [];
    const openIds: string[] = [];
    let skippedNoAssignee = 0;
    for (const task of tasks) {
      if (task.completed) continue;
      const assignee = task.members?.find(
        (member) => member.type === 'user' && member.role === 'assignee',
      );
      if (!assignee?.id) {
        skippedNoAssignee += 1;
        continue;
      }
      if (!openIds.includes(assignee.id)) openIds.push(assignee.id);
    }

    const userMap = new Map<string, string>();
    if (openIds.length > 0) {
      const userIds = await this.authNPaasService.getBatchMiaodaUserIdsByOpenIds(
        openIds,
        { feishuClientId: this.feishuService.getAppId() },
      );
      openIds.forEach((openId: string, index: number) => {
        const uid = userIds[index];
        if (uid) userMap.set(openId, uid);
      });
    }

    const unresolved: Array<{ task: FeishuTask; openId: string }> = [];
    for (const task of tasks) {
      if (task.completed) continue;
      const assignee = task.members?.find(
        (member) => member.type === 'user' && member.role === 'assignee',
      );
      if (!assignee?.id) continue;
      unresolved.push({ task, openId: assignee.id });
    }

    let convertedFailed = 0;
    for (const item of unresolved) {
      const uid = userMap.get(item.openId);
      if (!uid) {
        convertedFailed += 1;
        continue;
      }
      candidates.push({
        externalId: item.task.guid,
        assignee: uid,
        title: item.task.summary || '飞书任务',
      });
    }

    const counters = await this.upsertCandidates(candidates);
    this.logger.log(
      `飞书共享清单同步完成：清单 ${listGuid}，共 ${tasks.length} 条，新增 ${counters.added}，更新 ${counters.updated}，无负责人 ${skippedNoAssignee}，负责人转换失败 ${convertedFailed}`,
    );
    return {
      listGuid,
      total: tasks.length,
      added: counters.added,
      updated: counters.updated,
      skippedNoAssignee,
      convertedFailed,
      source: 'shared',
      needAuth: false,
    };
  }
}
