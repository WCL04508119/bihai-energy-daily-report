import { Global, Module } from '@nestjs/common';

import { DataScopeController } from './data-scope.controller';
import { DataScopeService } from './data-scope.service';

@Global()
@Module({
  controllers: [DataScopeController],
  providers: [DataScopeService],
  exports: [DataScopeService],
})
export class DataScopeModule {}
