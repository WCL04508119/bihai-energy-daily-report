import { IsOptional, IsString } from 'class-validator';

export class TaskItemListQueryDto {
  @IsOptional()
  @IsString()
  assigneeId?: string;
}