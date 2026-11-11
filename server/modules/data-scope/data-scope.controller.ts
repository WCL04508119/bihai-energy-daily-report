import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';

import { DataScopeService } from './data-scope.service';
import type { DataScopeInfo } from '@shared/api.interface';

@Controller('api/data-scope')
@NeedLogin()
export class DataScopeController {
  constructor(private readonly dataScope: DataScopeService) {}

  @Get('me')
  async me(@Req() req: Request): Promise<DataScopeInfo> {
    const context = await this.dataScope.resolveContext(
      req.userContext.roles,
      req.userContext.userId,
    );
    return {
      kind: context.scope.kind,
      departments: context.scope.departments,
      features: context.features,
    };
  }
}
