import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CanRole, NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { TaskPoolService } from './task-pool.service';
import { CreateTaskItemDto } from './dto/create-task-item.dto';
import { UpdateTaskItemDto } from './dto/update-task-item.dto';
import { TaskItemListQueryDto } from './dto/task-item-query.dto';
import type {
  TaskItem,
  TaskItemListResponse,
  DeleteResponse,
} from '@shared/api.interface';

@Controller('api/task-pool')
export class TaskPoolController {
  constructor(private readonly taskPoolService: TaskPoolService) {}

  @Get('mine')
  async findMine(@Req() req: Request): Promise<TaskItemListResponse> {
    const { userId } = req.userContext;
    return this.taskPoolService.findMine(userId);
  }

  @NeedLogin()
  @Get()
  async find(
    @Query() query: TaskItemListQueryDto,
  ): Promise<TaskItemListResponse> {
    return this.taskPoolService.find(query.assigneeId);
  }

  @Post()
  @CanRole(['dept_director', 'system_admin', 'company_leader'])
  async create(@Body() dto: CreateTaskItemDto): Promise<TaskItem> {
    return this.taskPoolService.create(dto);
  }

  @Patch(':id')
  @CanRole(['dept_director', 'system_admin', 'company_leader'])
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskItemDto,
  ): Promise<TaskItem> {
    return this.taskPoolService.update(id, dto);
  }

  @Delete(':id')
  @CanRole(['dept_director', 'system_admin', 'company_leader'])
  async remove(@Param('id') id: string): Promise<DeleteResponse> {
    await this.taskPoolService.remove(id);
    return { success: true };
  }
}