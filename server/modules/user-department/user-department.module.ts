import { Module } from '@nestjs/common';

import { UserDepartmentController } from './user-department.controller';
import { UserDepartmentService } from './user-department.service';

@Module({
  controllers: [UserDepartmentController],
  providers: [UserDepartmentService],
  exports: [UserDepartmentService],
})
export class UserDepartmentModule {}
