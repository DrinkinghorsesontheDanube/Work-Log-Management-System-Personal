# 部署全流程指南（从零到远程访问）

> 本文档面向"第一次把系统部署到云服务器或 NAS"的完整过程，包含前置准备、
> 数据迁移、日常更新与故障处理。已在本机运行、只想了解更新方式的直接看[第 6 节](#六版本更新)。

## 目录

1. [方案选择（先读这个）](#一方案选择)
2. [前置工作清单](#二前置工作清单)
3. [路线 A：云服务器全流程](#三路线-a云服务器)
4. [路线 B：NAS 全流程](#四路线-bnas)
5. [数据迁移：从本机搬到服务器](#五数据迁移)
6. [版本更新](#六版本更新)
7. [回滚](#七回滚)
8. [故障排查](#八故障排查)

---

## 一、方案选择

| | 国内云服务器 | 香港/海外轻量服务器 | 家庭 NAS |
|---|---|---|---|
| 成本 | 轻量 2核2G 约 ¥50-100/年（新用户价） | 同左 | 已有（只算修复费） |
| 域名备案 | **需要**（约 1-2 周） | 不需要 | 不需要 |
| 外网访问速度 | 快且稳定 | 较快 | 依赖 Tailscale 组网 |
| 适合场景 | 随时随地稳定访问、正规汇报演示 | 不想等备案 | 主要在家用、偶尔外出看 |

**决策建议**：
- 主要在家和单位两点一线，偶尔路上看一眼 → **修 NAS + Tailscale**（零成本、不暴露公网）
- 需要稳定外网访问 → 国内云 + 域名备案（正规），或香港轻量（快速起步免备案）
- 不确定 → 先用云服务器跑起来（投入小），NAS 修好后再迁移回（`data/` 目录拷回来即可，两边的数据库格式完全一致）

---

## 二、前置工作清单

### 云服务器路线

| # | 事项 | 说明 |
|---|---|---|
| 1 | 购买服务器 | 阿里云/腾讯云**轻量应用服务器**，2核2G 足够（单人工具）；镜像选 Ubuntu 24.04 LTS（或选"Docker 预装"镜像可跳过安装步骤）；香港节点免备案 |
| 2 | 防火墙/安全组 | 控制台里放行 22（SSH 管理）、80/443（HTTPS）；**4173 不要对外开放** |
| 3 | 域名（仅国内云需要） | 云厂商处购买 → ICP 备案（控制台有引导流程，约 1-2 周）；不备案的替代：香港节点，或仅用 Tailscale |
| 4 | SSH 客户端 | Windows 自带：PowerShell 里 `ssh root@服务器IP` |

### NAS 路线

| # | 事项 | 说明 |
|---|---|---|
| 1 | 确认 Docker 支持 | 群晖 = Container Manager，威联通 = Container Station；型号过老不支持的话只能走云路线 |
| 2 | Tailscale 账号 | [tailscale.com](https://tailscale.com) 注册（免费版：3 用户 100 台设备，足够） |
| 3 | 共享目录 | NAS 上建一个目录存代码与数据（如 `/volume1/docker/worklog`） |

### 通用

- 代码已在 GitHub（本仓库），服务器/NAS 能访问它；国内服务器拉 GitHub 慢时可先本地打包 zip 上传
- **迁移数据前**：在本机「系统设置 → 导出数据」做一份 JSON 备份，或直接拷贝 `data/` 目录（见第五节）

---

## 三、路线 A：云服务器

### 3.1 安装 Docker（预装镜像跳过）

```bash
curl -fsSL https://get.docker.com | sh
docker --version   # 验证
```

### 3.2 获取代码并启动

```bash
git clone https://github.com/<你的用户名>/Work-Log-Management-System-Personal.git
cd Work-Log-Management-System-Personal
docker compose up -d --build
docker logs worklog | grep PASSWORD   # 查看自动生成的访问密码
```

验证：`curl http://localhost:4173/api/health` 返回 `{"ok":true,...}`。

### 3.3 迁移数据（见第五节）后即可通过 IP 访问

### 3.4 对外访问（三选一）

**方式 1：域名 + HTTPS（国内云正规路线）**

域名解析 A 记录指向服务器 IP，安装 Caddy 自动签发证书：

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy.list
sudo apt update && sudo apt install caddy
```

`/etc/caddy/Caddyfile`（把域名换成你的）：

```
worklog.example.com {
    reverse_proxy 127.0.0.1:4173
}
```

`sudo systemctl reload caddy` —— 完成后用 `https://worklog.example.com` 访问。

**方式 2：Tailscale（不暴露公网，推荐配合 NAS）**

服务器、手机、电脑都安装 Tailscale 并登录同一账号，之后用服务器的 Tailscale IP（100.x.x.x）访问 `http://100.x.x.x:4173`。

**方式 3：裸 IP + 端口（仅临时调试用）**

不配证书直接暴露 4173 属于明文传输，长期使用不接受。

---

## 四、路线 B：NAS

1. 代码放到共享目录（如 `/volume1/docker/worklog`）：git clone，或本地打包 zip 上传解压
2. Container Manager → 新增项目 → 选择该目录下的 `docker-compose.yml` → 启动
3. `docker logs worklog | grep PASSWORD` 查看密码
4. 数据迁移见第五节
5. 手机/电脑安装 Tailscale 并登录同一账号，用 NAS 的 Tailscale IP 访问

> 若不想用图形界面，NAS 开 SSH 后与云服务器操作完全相同（3.1-3.3）。

---

## 路线 C：飞牛 NAS（fnOS）

飞牛 fnOS 底层是 Debian，应用中心装上 Docker 后，操作与标准 Linux 一致。

1. **安装 Docker**：fnOS 桌面 → 应用中心 → 搜索「Docker」→ 安装
2. **开启 SSH**：设置 → 系统服务（或终端相关选项）→ 打开 SSH（端口 22）；同时记下 NAS 的局域网 IP（如 `192.168.1.10`）
3. **上传代码**（两种任选其一）：
   - **推荐（便于以后更新）**：fnOS 开 SSH 后 `sudo apt update && sudo apt install -y git`，然后 `git clone https://github.com/<你的用户名>/Work-Log-Management-System-Personal.git`
   - 或者：GitHub 仓库页 → Code → Download ZIP，飞牛文件管理上传到共享目录后解压（以后更新需重新下载）
4. **SSH 登录并构建启动**：Windows 上 PowerShell 执行 `ssh 你的用户名@NAS的IP`（密码 = fnOS 登录密码），然后：

   ```bash
   sudo -i                                                    # 切到 root
   cd /路径/Work-Log-Management-System-Personal               # 进入项目目录
   docker compose up -d --build                               # 首次构建约几分钟（走国内 npm 源）
   docker logs worklog | grep PASSWORD                        # 查看访问密码（迁移数据则跳过）
   ```

   > 若提示 `docker: command not found`：确认 Docker 应用已安装完成后重新登录 SSH。

5. **访问**：局域网内浏览器打开 `http://NAS的IP:4173`
6. **迁移数据**：先停掉 Windows 本机服务（否则两边数据会分叉），把本机 `data/` 目录内容通过飞牛文件管理/SMB 上传到 NAS 项目的 `data/` 目录（覆盖空目录），然后 `docker compose restart` —— 数据库、AI 配置、登录会话全部平移
7. **外网访问**：fnOS 应用中心若有 Tailscale 直接安装并登录；没有则 SSH 执行 `curl -fsSL https://tailscale.com/install.sh | sh && tailscale up`，手机/电脑装 Tailscale 登录同一账号后，用 NAS 的 Tailscale IP（100.x.x.x）访问

以后更新同样执行 `bash scripts/update.sh`（需第 3 步用了 git clone 方式）。

---

## 五、数据迁移

数据全部在 `data/` 目录，迁移 = 拷贝目录。

**从本机（Windows）迁到服务器/NAS：**

1. 本机停止服务（任务计划里停掉，或任务管理器结束 node 进程）——SQLite 运行中拷贝可能不一致，**先停再拷**
2. 打包本机 `data/` 目录，上传到服务器的 `Work-Log-Management-System-Personal/data/`（覆盖空目录）
3. 启动服务。数据库、AI 配置（含 API Key）、登录会话全部平移

或者更轻量的方式：本机「系统设置 → 导出数据」导出 JSON，在服务器上「导入数据」导入（自动兼容，导入前服务器自动备份）。

---

## 六、版本更新

以后每次代码更新推送到 GitHub 后，服务器/NAS 上执行：

```bash
cd Work-Log-Management-System-Personal
bash scripts/update.sh
```

脚本做的事：拉取代码 → 重建并重启容器 → 健康检查（失败会提示查看日志）。

手动等价操作：

```bash
git pull
docker compose up -d --build
```

**数据安全机制**：
- `data/` 挂载在容器外，重建容器数据不动
- 容器每次启动自动做一次数据库快照备份（保留 14 份），即**每次更新天然带更新前快照**
- 无需数据库迁移脚本：新功能只是新增集合名，旧数据库直接兼容

---

## 七、回滚

**代码回滚**（新版有问题）：

```bash
git log --oneline -5        # 找到上一个正常版本的提交号
git checkout <提交号>
docker compose up -d --build
git checkout main           # 排查完切回主线
```

**数据回滚**（误操作/数据损坏）：

```bash
docker compose stop
cp data/backups/<某次备份>.sqlite data/worklog.sqlite
rm -f data/worklog.sqlite-wal data/worklog.sqlite-shm
docker compose start
```

---

## 八、故障排查

| 现象 | 排查 |
|---|---|
| 页面打不开 | `docker ps` 看容器是否在跑；`docker logs worklog` 看报错；云服务器检查安全组是否放行 80/443 |
| 忘记访问密码 | `docker logs worklog \| grep PASSWORD`；或删除 `data/config.json` 重启（重新生成） |
| 更新后 502/白屏 | 容器可能没起来：`docker compose logs worklog`；前端构建失败时重新 `docker compose up -d --build` |
| 磁盘满 | 备份自动保留 14 份；`docker system prune` 清理旧镜像 |
| 想验证服务活着 | `curl http://localhost:4173/api/health` |
| AI 功能报错 | 系统设置里检查 AI 配置；`docker logs worklog` 看 `/api/ai` 报错（Key 无效/额度用尽会在错误信息中说明） |

## 安全清单（上生产前最后过一遍）

- [ ] 云服务器：HTTPS 已配置，4173 端口未对公网开放
- [ ] NAS：走 Tailscale，未做公网端口映射
- [ ] 访问密码已改为自己的强密码（系统设置内修改）
- [ ] 自动备份已确认在跑（`data/backups/` 有文件）
- [ ] 知道如何回滚（第七节）
