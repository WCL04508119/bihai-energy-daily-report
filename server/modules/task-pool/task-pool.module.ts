import { Module } from '@nestjs/common';
import { TaskPoolController } from './task-pool.controller';
import { TaskPoolService } from './task-pool.service';

@Module({
  controllers: [TaskPoolController],
  providers: [TaskPoolService],
})
export class TaskPoolModule {}