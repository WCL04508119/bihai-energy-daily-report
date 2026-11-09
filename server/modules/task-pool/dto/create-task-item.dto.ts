import { IsString, Length } from 'class-validator';
import type { CreateTaskItemRequest } from '@shared/api.interface';

export class CreateTaskItemDto implements CreateTaskItemRequest {
  @IsString()
  assigneeId!: string;

  @IsString()
  @Length(1, 255)
  title!: string;
}