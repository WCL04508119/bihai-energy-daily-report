import { Global, Module } from '@nestjs/common';
import { FeishuService } from './feishu.service';

@Global()
@Module({
  providers: [FeishuService],
  exports: [FeishuService],
})
export class FeishuModule {}