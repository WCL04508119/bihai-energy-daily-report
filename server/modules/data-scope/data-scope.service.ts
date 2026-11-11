import { Injectable, Logger } from '@nestjs/common';
import { AuthorizationSDK } from '@lark-apaas/fullstack-nestjs-core';

import type { DataScopeFeatures } from '@shared/api.interface';

export const ROLE_SYSTEM_ADMIN = 'system_admin';
export const ROLE_DEPT_DIRECTOR = 'dept_director';
export const ROLE_COMPANY_LEADER = 'company_leader';
export const ROLE_HR_ADMIN = 'hr_admin';

export const MANAGER_ROLES: string[] = [
  ROLE_SYSTEM_ADMIN,
  ROLE_DEPT_DIRECTOR,
  ROLE_COMPANY_LEADER,
];

export const FULL_ACCESS_ROLES: string[] = [
  ROLE_SYSTEM_ADMIN,
  ROLE_COMPANY_LEADER,
  ROLE_HR_ADMIN,
];

export type DataScopeKind = 'all' | 'department' | 'self';

export interface DataScope {
  kind: DataScopeKind;
  userId: string;
  departments: string[];
  readOnlyDepartments: string[];
}

export interface DataScopeContext {
  scope: DataScope;
  features: DataScopeFeatures;
}

@Injectable()
export class DataScopeService {
  private readonly logger = new Logger(DataScopeService.name);

  constructor(private readonly authzSDK: AuthorizationSDK) {}

  isManager(roles: string[] | undefined): boolean {
    const list: string[] = roles ?? [];
    return list.some((role: string) => MANAGER_ROLES.includes(role));
  }

  async resolve(
    roles: string[] | undefined,
    userId: string,
  ): Promise<DataScope> {
    const context = await this.resolveContext(roles, userId);
    return context.scope;
  }

  async resolveContext(
    roles: string[] | undefined,
    userId: string,
  ): Promise<DataScopeContext> {
    const list: string[] = roles ?? [];
    const isMember = async (role: string): Promise<boolean> =>
      list.includes(role) || (await this.isRoleMember(role, userId));

    const isSystemAdmin: boolean = await isMember(ROLE_SYSTEM_ADMIN);
    const isCompanyLeader: boolean = await isMember(ROLE_COMPANY_LEADER);
    const isHrAdmin: boolean = await isMember(ROLE_HR_ADMIN);
    const isDeptDirector: boolean = await isMember(ROLE_DEPT_DIRECTOR);

    const features: DataScopeFeatures = {
      isSystemAdmin,
      isDeptDirector,
      isCompanyLeader,
      isHrAdmin,
      canViewManagerDashboard:
        isSystemAdmin || isCompanyLeader || isDeptDirector,
      canViewStats:
        isSystemAdmin || isCompanyLeader || isDeptDirector || isHrAdmin,
      canManageTaskPool: isSystemAdmin || isCompanyLeader || isDeptDirector,
    };

    if (isSystemAdmin || isCompanyLeader || isHrAdmin) {
      return {
        features,
        scope: {
          kind: 'all',
          userId,
          departments: [],
          readOnlyDepartments: [],
        },
      };
    }

    return {
      features,
      scope: {
        kind: 'self',
        userId,
        departments: [],
        readOnlyDepartments: [],
      },
    };
  }

  canAccessDepartment(scope: DataScope, department: string): boolean {
    if (scope.kind === 'all') return true;
    if (scope.kind === 'department') {
      return scope.departments.includes(department);
    }
    return false;
  }

  private async isRoleMember(
    roleBizID: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const response = await this.authzSDK.members.list(roleBizID, {
        type: 'User',
        page: 1,
        pageSize: 100,
      });
      const users = response.members.userList ?? [];
      return users.some(
        (user) =>
          user.userID === userId ||
          user.miaodaUserID === userId,
      );
    } catch (error) {
      this.logger.warn(
        `角色成员查询失败 role=${roleBizID}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }
}
