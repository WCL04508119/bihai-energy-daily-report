import { Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { eq } from 'drizzle-orm';

import { userDepartments } from '../../database/schema';
import {
  resolveDirectorDepartment,
  type MyDepartmentInfo,
} from '@shared/api.interface';

@Injectable()
export class UserDepartmentService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getByUserId(userId: string): Promise<MyDepartmentInfo> {
    if (!userId) return { department: null };
    const directorDepartment = resolveDirectorDepartment(userId);
    if (directorDepartment) return { department: directorDepartment };
    const rows: { department: string }[] = await this.db
      .select({ department: userDepartments.department })
      .from(userDepartments)
      .where(eq(userDepartments.userId, userId))
      .limit(1);
    return { department: rows[0]?.department ?? null };
  }
}
