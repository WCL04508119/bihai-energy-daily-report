import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
  AuthNPaasService,
} from '@lark-apaas/fullstack-nestjs-core';
import { eq, inArray } from 'drizzle-orm';

import { taskItems } from '../../database/schema';
import { FeishuService } from '../feishu/feishu.service';
import type { TaskPoolSyncResponse } from '@shared/api.interface';

const TASKLIST_NAME = '日报任务池';

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

@Injectable()
export class FeishuTaskSyncService {
  private readonly logger = new Logger(FeishuTaskSyncService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly feishuService: FeishuService,
    private readonly authNPaasService: AuthNPaasService,
  ) {}

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
    const hit = existing.find((t) => t.name === TASKLIST_NAME);
    if (hit?.guid) return hit.guid;
    this.logger.log(`未找到共享任务清单「${TASKLIST_NAME}」，正在创建`);
    return this.createTasklist(TASKLIST_NAME);
  }

  private async listTasksInTasklist(tasklistGuid: string): Promise<FeishuTask[]> {
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

  private extractOpenIds(tasks: FeishuTask[]): {
    openIds: string[];
    busy: Array<{ task: FeishuTask; openId: string }>;
    skippedNoAssignee: number;
  } {
    const busy: Array<{ task: FeishuTask; openId: string }> = [];
    const openIds: string[] = [];
    let skippedNoAssignee = 0;
    for (const task of tasks) {
      if (task.completed) continue;
      const assignee = task.members?.find(
        (m) => m.type === 'user' && m.role === 'assignee',
      );
      if (!assignee?.id) {
        skippedNoAssignee += 1;
        continue;
      }
      busy.push({ task, openId: assignee.id });
      if (!openIds.includes(assignee.id)) openIds.push(assignee.id);
    }
    return { openIds, busy, skippedNoAssignee };
  }

  async sync(): Promise<TaskPoolSyncResponse> {
    const listGuid = await this.ensureTasklist();
    const tasks = await this.listTasksInTasklist(listGuid);
    const { openIds, busy, skippedNoAssignee } = this.extractOpenIds(tasks);

    const userMap = new Map<string, string>();
    if (openIds.length > 0) {
      const userIds =
        await this.authNPaasService.getBatchMiaodaUserIdsByOpenIds(openIds, {
          feishuClientId: this.feishuService.getAppId(),
        });
      openIds.forEach((openId: string, index: number) => {
        const uid = userIds[index];
        if (uid) userMap.set(openId, uid);
      });
    }

    const candidates: SyncCandidate[] = [];
    let convertedFailed = 0;
    for (const item of busy) {
      const uid = userMap.get(item.openId);
      if (!uid) {
        convertedFailed += 1;
        continue;
      }
      candidates.push({
        externalId: item.task.guid,
        assignee: uid,
        title: item.task.summary,
      });
    }

    let added = 0;
    let updated = 0;
    if (candidates.length > 0) {
      const existingRows = await this.db
        .select({ id: taskItems.id, externalId: taskItems.externalId })
        .from(taskItems)
        .where(
          inArray(
            taskItems.externalId,
            candidates.map((c: SyncCandidate) => c.externalId),
          ),
        );
      const existingByExternal = new Map<string, string>();
      for (const row of existingRows) {
        if (row.externalId) existingByExternal.set(row.externalId, row.id);
      }

      for (const candidate of candidates) {
        const currentId = existingByExternal.get(candidate.externalId);
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
    }

    const result: TaskPoolSyncResponse = {
      listGuid,
      total: tasks.length,
      added,
      updated,
      skippedNoAssignee,
      convertedFailed,
    };
    this.logger.log(
      `飞书任务同步完成：清单 ${listGuid}，共 ${result.total} 条，新增 ${added}，更新 ${updated}，无负责人 ${skippedNoAssignee}，负责人转换失败 ${convertedFailed}`,
    );
    return result;
  }
}