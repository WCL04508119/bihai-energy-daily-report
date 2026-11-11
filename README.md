# 碧海能源工作日报系统

企业内部工作日报填报与汇总系统，全栈应用，前端 React、后端 NestJS。本仓库为该应用源码的快照备份，原始应用托管在飞书妙搭上运行。

## 功能范围

- 员工日报：按日期填报工作内容、工时、任务来源，支持语音输入转文字、复制昨日、任务来源多选
- 汇总报表：个人周报、部门周报 / 月报，按部门与时间区间聚合
- 统计：填报率、完成情况、出勤日标记等多维统计
- 管理者看板：管理者视角的汇总看板，含 AI 分析面板
- 数据范围：按角色控制可见数据范围（本人 / 部门 / 全公司）
- 用户部门：人员与部门的归属维护，用于报表归属与统计口径
- 任务池：室主任维护任务条目，员工填报时从本人任务中选取
- 飞书任务同步：把飞书任务清单中的任务同步进任务池
- 定时发送：按计划把汇总结果推送出去
- 报表导出：生成 docx 格式的报表文档

## 快照记录

| 日期 | 说明 |
|---|---|
| 2026-11-11 | 同步妙搭最新发布：新增管理者看板、数据范围、用户部门模块，日报与统计页增强 |
| 2026-11-09 | 首次快照 |

## 目录结构

```
client/            前端，React 19 + Vite + TypeScript + Tailwind + shadcn/ui
  src/api/         调用后端的接口封装
  src/pages/       页面（日报、周报、月报、统计、任务池等）
  src/components/  UI 与业务组件
server/            后端，NestJS 10
  modules/         业务模块：daily-report、weekly/monthly/department-report、stats、manager-dashboard、data-scope、user-department、task-pool、scheduled-send、feishu、feishu-task-sync、report-document
  capabilities/    平台插件调用定义（语音转写、发消息、审批、多维表格同步等）
  database/        drizzle-orm schema
shared/            前后端共用的类型与常量
scripts/           构建、开发、lint 脚本
```

## 本地运行

需要 Node.js ≥ 22、npm ≥ 10。

```bash
npm install
cp .env.example .env      # 填入飞书应用凭据
npm run dev               # 同时起后端与前端
```

也可以分别启动：

```bash
npm run dev:server        # NestJS，watch 模式
npm run dev:client        # Vite
```

`npm run dev` / `npm run build` 走的是 `scripts/*.sh`，Windows 下需要 Git Bash 或 WSL；直接用上面前两条分启命令可以绕开。

## 环境变量

| 变量 | 说明 |
|---|---|
| `FEISHU_APP_ID` | 飞书自建应用 App ID |
| `FEISHU_APP_SECRET` | 飞书自建应用 App Secret，仅放本地 `.env` |
| `LOG_DIR` / `LOG_REQUEST_BODY` / `LOG_RESPONSE_BODY` | 日志目录与请求体记录开关 |

`.env` 已在 `.gitignore` 中排除，仓库里只保留 `.env.example` 占位。

## 已知限制

- 后端使用了妙搭平台的登录鉴权与托管数据库能力（`@lark-apaas/fullstack-nestjs-core`、`AuthNPaasService`），脱离妙搭自建部署需要自行补齐身份认证与数据库这两块，不能只靠 `npm install` 直接跑成生产可用的服务。
- `server/capabilities/*.json` 是平台插件的调用声明（语音转写、发飞书消息、审批、多维表格），在妙搭之外运行需要对接等价能力。
- 本仓库不含业务数据、数据库内容、上传附件与内部运维记录。

## 安全提示

如果仓库历史或任何公开渠道曾经出现过有效的 App Secret，请到飞书开放平台重置该应用的 Secret，再更新本地 `.env`。
