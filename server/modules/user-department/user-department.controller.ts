import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';

import { UserDepartmentService } from './user-department.service';
import type { MyDepartmentInfo } from '@shared/api.interface';

@Controller('api/user-departments')
@NeedLogin()
export class UserDepartmentController {
  constructor(private readonly userDepartment: UserDepartmentService) {}

  @Get('mine')
  async mine(@Req() req: Request): Promise<MyDepartmentInfo> {
    return this.userDepartment.getByUserId(req.userContext.userId);
  }
}
