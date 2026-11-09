import { IsString, Length } from 'class-validator';
import type { UpdateTaskItemRequest } from '@shared/api.interface';

export class UpdateTaskItemDto implements UpdateTaskItemRequest {
  @IsString()
  @Length(1, 255)
  title!: string;
}