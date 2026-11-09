import { Injectable } from '@nestjs/common';
import * as lark from '@larksuiteoapi/node-sdk';

// 凭据从环境变量读取，本地配置写在 .env（已在 .gitignore 中排除），不要提交到仓库
const FEISHU_APP_ID = process.env.FEISHU_APP_ID ?? '';
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET ?? '';

@Injectable()
export class FeishuService {
  private readonly client: lark.Client;

  constructor() {
    this.client = new lark.Client({
      appId: FEISHU_APP_ID,
      appSecret: FEISHU_APP_SECRET,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Feishu,
    });
  }

  getClient(): lark.Client {
    return this.client;
  }

  getAppId(): string {
    return FEISHU_APP_ID;
  }
}