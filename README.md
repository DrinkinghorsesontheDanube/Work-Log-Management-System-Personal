# 工作日志管理系统

面向个人的工作日志管理工具，围绕**工作日志 + 项目 + 待办 + 客户**四个核心对象，提供智能录入、看板管理、日历回顾与 AI 辅助总结能力。前后端同进程服务，数据存服务端 SQLite，支持本地、云服务器、家庭 NAS 部署，**多设备远程访问同一份数据**。

## 功能特性

- **工作台**：自然语言智能录入（本地规则 + 可选 AI 识别），自动拆分为日志、项目、待办、客户
- **日历**：按日/周/月查看工作日志，一键生成日报/周报/月报（支持 AI 润色）
- **项目**：项目阶段管理（可自定义阶段流）、甘特图计划、进度自动同步
- **待办**：看板/列表双视图、优先级与分类筛选、已完成记录折叠收纳、批量操作
- **客户**：客户档案、联系人、拜访记录、跟进状态
- **数据**：服务端 SQLite 持久化，登录访问，自动轮转备份，支持导出/导入 JSON 备份，旧版 localStorage 数据自动合并迁移
- **多设备**：按实体增量同步 + 焦点自动刷新，多设备同时编辑不互相覆盖
- **AI**：服务端代理调用 OpenAI 兼容接口，API Key 只存服务端，浏览器不接触 Key

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3（Composition API + `<script setup>`）+ TypeScript + Vite |
| 状态 | Pinia |
| 路由 | Vue Router |
| UI | Naive UI + 自定义样式（CSS 变量） |
| 图表 | ECharts |
| 后端 | Node.js ≥ 24 零依赖 HTTP 服务（`server/`，内置 node:sqlite） |
| 存储 | SQLite（`data/worklog.sqlite`） |

## 目录结构

```
.
├── frontend/            # 前端应用（Vue 3 + Vite + TS）
│   ├── src/
│   │   ├── components/  # 通用组件（含登录遮罩 LoginOverlay）
│   │   ├── views/       # 页面组件
│   │   ├── stores/      # Pinia 状态管理
│   │   ├── services/    # AI 与智能录入服务（AI 走服务端代理）
│   │   ├── utils/       # 存储（缓存+API 同步）/日期/种子数据/旧数据迁移
│   │   ├── types/       # TypeScript 类型定义
│   │   ├── router/      # 路由配置（含全局初始化守卫）
│   │   └── main.ts
│   └── start-silent.vbs # Windows 静默启动器
├── server/              # 后端：静态托管 + REST API + AI 代理 + 认证（零 npm 依赖）
│   ├── server.js
│   ├── db.js            # SQLite 访问层
│   └── ai.js            # AI 上游代理
├── data/                # 运行数据（SQLite + 密码配置，已 gitignore）
├── Dockerfile           # 容器镜像（多阶段：构建前端 + 运行）
├── docker-compose.yml
├── scripts/             # Windows 部署脚本（安装/卸载开机自启、手动启动）
├── docs/                # 需求 / 架构 / 使用 / 部署文档
└── .gitignore
```

## 快速开始

### 环境要求

- Node.js ≥ 24（后端使用内置 node:sqlite）

### 开发模式（热更新）

```bash
# 终端 1：后端（同时托管 API）
node server/server.js

# 终端 2：前端（/api 自动代理到 4173）
cd frontend
npm install
npm run dev
```

### 生产模式

```bash
cd frontend
npm run build       # 类型检查 + 打包到 dist/
node server/server.js
# 访问 http://localhost:4173
```

首次启动会自动生成访问密码（打印在启动日志中，只显示一次），登录后即可使用。

### 开机自启（Windows）

- **安装**：右键 `scripts/install-autostart.ps1` → 使用 PowerShell 运行（需管理员）
- **手动启动**：右键 `scripts/start.ps1` → 使用 PowerShell 运行
- **卸载**：右键 `scripts/uninstall-autostart.ps1` → 使用 PowerShell 运行

### Docker（云服务器 / NAS）

```bash
docker compose up -d --build
docker logs worklog | grep PASSWORD   # 查看访问密码
```

部署细节（HTTPS、Tailscale 组网、反向代理、备份恢复）见 **[部署指南](docs/deployment.md)**。

## 数据说明

- 所有业务数据存储在服务端 `data/worklog.sqlite`，多设备访问同一份数据
- 备份 = 拷贝 `data/` 目录；也可在「系统设置 → 导出数据」导出 JSON（不含 AI API Key）
- 清空数据不会清除 AI 服务配置；访问密码由 `data/config.json`（哈希）或 `AUTH_PASSWORD` 环境变量管理

## 文档

- [需求文档](docs/requirements.md)
- [技术架构](docs/architecture.md)
- [使用说明](docs/usage.md)
- [部署指南](docs/deployment.md)

## License

Private（私有项目）
