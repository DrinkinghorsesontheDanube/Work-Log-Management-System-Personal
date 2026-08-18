# 工作日志管理系统 - 使用说明

## 首次使用

1. 右键点击 `scripts/install-autostart.ps1`
2. 选择「使用 PowerShell 运行」
3. 按提示操作即可（需管理员权限，配置开机自启）

## 日常使用

- 开机后自动后台运行（无弹窗）
- 浏览器访问 <http://localhost:4173>

## 不再使用

右键点击 `scripts/uninstall-autostart.ps1`，选择「使用 PowerShell 运行」，即可停止自启并关闭服务。

## 脚本说明

| 脚本 | 用途 |
|---|---|
| `scripts/install-autostart.ps1` | 首次使用，配置开机自启 |
| `scripts/uninstall-autostart.ps1` | 取消开机自启并停止服务 |
| `scripts/start.ps1` | 手动启动（临时使用） |

## 访问地址

<http://localhost:4173>

## 注意事项

- 需要已安装 Node.js
- 数据存储在浏览器本地
- 建议定期在「系统设置 → 导出数据」中备份
