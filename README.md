# WorkLog 工作日志管理系统

面向个人的工作日志管理工具，围绕**工作日志 + 项目 + 待办 + 客户**四个核心对象，提供智能录入、看板管理、日历回顾与 AI 辅助总结能力。数据完全存储在浏览器本地，无需服务器，开箱即用。

## 功能特性

- **工作台**：自然语言智能录入（本地规则 + 可选 AI 识别），自动拆分为日志、项目、待办、客户
- **日历**：按日/周/月查看工作日志，一键生成日报/周报/月报（支持 AI 润色）
- **项目**：项目阶段管理（可自定义阶段流）、甘特图计划、进度自动同步
- **待办**：看板/列表双视图、优先级与分类筛选、已完成记录折叠收纳、批量操作
- **客户**：客户档案、联系人、拜访记录、跟进状态
- **数据**：LocalStorage 持久化，支持一键导出/导入 JSON 备份

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Vue 3（Composition API + `<script setup>`）+ TypeScript |
| 构建 | Vite |
| 状态 | Pinia |
| 路由 | Vue Router |
| UI | Naive UI + 自定义样式（CSS 变量） |
| 图表 | ECharts |

## 目录结构

```
.
├── frontend/            # 前端应用（Vue 3 + Vite + TS）
│   ├── src/
│   │   ├── components/  # 通用组件
│   │   ├── views/       # 页面组件
│   │   ├── stores/      # Pinia 状态管理
│   │   ├── services/    # AI 与智能录入服务
│   │   ├── utils/       # 工具函数（存储/实体/种子数据）
│   │   ├── types/       # TypeScript 类型定义
│   │   ├── router/      # 路由配置
│   │   └── main.ts
│   ├── serve.js         # 生产环境静态服务（端口 4173）
│   └── start-silent.vbs # 静默启动器（无窗口后台运行）
├── scripts/             # 部署脚本（安装/卸载开机自启、手动启动）
├── docs/                # 需求与架构文档
├── .editorconfig
└── .gitignore
```

## 快速开始

### 环境要求

- Node.js ≥ 18

### 开发模式（热更新）

```bash
cd frontend
npm install
npm run dev
```

### 生产模式

```bash
cd frontend
npm run build       # 类型检查 + 打包到 dist/
node serve.js       # 静态服务，访问 http://localhost:4173
```

### 开机自启（Windows）

- **安装**：右键 `scripts/install-autostart.ps1` → 使用 PowerShell 运行（需管理员）
- **手动启动**：右键 `scripts/start.ps1` → 使用 PowerShell 运行
- **卸载**：右键 `scripts/uninstall-autostart.ps1` → 使用 PowerShell 运行

## 数据说明

- 所有数据存储在浏览器 **LocalStorage**（键前缀 `worklog_`）
- 建议定期在「系统设置 → 导出数据」中备份
- 清空数据不会清除 AI 服务配置

## 文档

- [需求文档](docs/requirements.md)
- [技术架构](docs/architecture.md)
- [使用说明](docs/usage.md)

## License

Private（私有项目）
