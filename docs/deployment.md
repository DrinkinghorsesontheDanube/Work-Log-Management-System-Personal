# 部署指南

WorkLog 采用"Vue 3 前端 + Node 零依赖后端 + SQLite"架构，前后端由**同一个进程**提供服务（端口 4173），数据统一存在服务端 `data/worklog.sqlite`，任何设备通过浏览器访问都是同一份数据。

```
浏览器（任何设备）
   │  http(s)://服务器地址:4173
   ▼
server/server.js（Node ≥ 24，零 npm 依赖）
   ├── 静态托管 frontend/dist
   ├── /api/*       数据读写（会话认证）
   └── /api/ai/*    AI 代理（API Key 只存服务端）
   ▼
data/worklog.sqlite（SQLite，含全部业务数据 + AI 配置）
```

## 访问密码

- 首次启动若未设置 `AUTH_PASSWORD` 环境变量，会自动生成 12 位随机密码：哈希写入 `data/config.json`，**明文只打印一次到启动日志**。
- Docker 部署首次启动后执行 `docker logs worklog` 查看密码。
- 修改密码：设置环境变量 `AUTH_PASSWORD` 后重启；或删除 `data/config.json` 重启（重新生成）。

## 方式一：本地 Windows（开机自启）

1. `cd frontend && npm install && npm run build`
2. 右键 `scripts/install-autostart.ps1` → 使用 PowerShell 运行（需管理员）
3. 访问 http://localhost:4173

启动链路：计划任务 → `frontend/start-silent.vbs` → `node server/server.js`（隐藏窗口）。

## 方式二：云服务器（Docker + HTTPS）

```bash
# 1. 上传代码到服务器后
docker compose up -d --build

# 2. 查看自动生成的访问密码
docker logs worklog | grep PASSWORD
```

公网访问必须加 HTTPS，推荐 Caddy（自动签发证书），`/etc/caddy/Caddyfile`：

```
worklog.example.com {
    reverse_proxy 127.0.0.1:4173
}
```

防火墙只放行 80/443，**不要**把 4173 直接暴露到公网。

## 方式三：家庭 NAS

**推荐：Tailscale 组网（不暴露公网，零运维）**

1. NAS 和手机/电脑都安装 Tailscale 并登录同一账号
2. NAS 上用 Docker 面板部署本项目（同 docker-compose.yml）
3. 任何设备访问 `http://NAS的Tailscale地址:4173`

**备选：反向代理暴露公网**（群晖/威联通自带 DSM 反代或 NPM）：

- 必须启用 HTTPS（Let's Encrypt 证书）
- 强密码 + 登录限流已内置（每 IP 每 5 分钟 10 次）
- 不要使用纯 HTTP 端口转发

## 数据备份与迁移

- **备份**：拷贝 `data/` 目录即可（SQLite 主文件 + WAL；建议先停服务或使用 `sqlite3 .backup`）。也可在应用内「系统设置 → 导出数据」导出 JSON。
- **从 v1.1（localStorage 版）升级**：用**原来存有数据的浏览器**打开新系统并登录，首次进入会自动把浏览器 localStorage 里的旧数据迁移到服务器（服务器上只有演示数据时）。迁移标记写入 localStorage（`worklog_migrated_v2`），不会重复覆盖。
- **恢复**：把 `data/` 目录放回新机器后启动；或用「导入数据」导入 JSON 备份（API Key 会自动沿用服务器已保存的）。

## 安全说明

- 所有 `/api/*` 接口（除登录/健康检查）需要会话认证：HttpOnly Cookie（SameSite=Lax，30 天）或 `Authorization: Bearer <token>`。
- AI 调用全部经服务端代理（`/api/ai/chat`、`/api/ai/test`），浏览器永远接触不到 API Key；导出的 JSON 备份同样不包含 Key。
- 静态服务有路径穿越防护；登录接口有限流；SPA 回退到 index.html。
