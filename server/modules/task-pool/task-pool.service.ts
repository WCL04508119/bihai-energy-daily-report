import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { eq } from 'drizzle-orm';
import { taskItems } from '../../database/schema';
import type {
  TaskItem,
  TaskItemListResponse,
  CreateTaskItemRequest,
  UpdateTaskItemRequest,
} from '@shared/api.interface';

interface TaskItemRow {
  id: string;
  assigneeId: string;
  title: string;
}

@Injectable()
export class TaskPoolService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  private toTaskItem(row: TaskItemRow): TaskItem {
    return { id: row.id, assigneeId: row.assigneeId, title: row.title };
  }

  private selectFields = {
    id: taskItems.id,
    assigneeId: taskItems.assignee,
    title: taskItems.title,
  };

  async findMine(userId: string): Promise<TaskItemListResponse> {
    const rows = await this.db
      .select(this.selectFields)
      .from(taskItems)
      .where(eq(taskItems.assignee, userId))
      .orderBy(taskItems.title);
    return { items: rows.map((r) => this.toTaskItem(r)) };
  }

  async find(assigneeId?: string): Promise<TaskItemListResponse> {
    const rows = await (assigneeId
      ? this.db
          .select(this.selectFields)
          .from(taskItems)
          .where(eq(taskItems.assignee, assigneeId))
          .orderBy(taskItems.title)
      : this.db
          .select(this.selectFields)
          .from(taskItems)
          .orderBy(taskItems.title));
    return { items: rows.map((r) => this.toTaskItem(r)) };
  }

  async create(dto: CreateTaskItemRequest): Promise<TaskItem> {
    const [row] = await this.db
      .insert(taskItems)
      .values({ assignee: dto.assigneeId, title: dto.title })
      .returning(this.selectFields);
    return this.toTaskItem(row);
  }

  async update(id: string, dto: UpdateTaskItemRequest): Promise<TaskItem> {
    const [row] = await this.db
      .update(taskItems)
      .set({ title: dto.title })
      .where(eq(taskItems.id, id))
      .returning(this.selectFields);
    if (!row) throw new NotFoundException('任务不存在');
    return this.toTaskItem(row);
  }

  async remove(id: string): Promise<void> {
    const [row] = await this.db
      .delete(taskItems)
      .where(eq(taskItems.id, id))
      .returning({ id: taskItems.id });
    if (!row) throw new NotFoundException('任务不存在');
  }
}