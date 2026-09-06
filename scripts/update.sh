#!/usr/bin/env bash
# WorkLog 服务器一键更新：拉取代码 → 重建容器 → 健康检查
# 用法：在服务器/NAS 上执行  bash scripts/update.sh
set -e

cd "$(dirname "$0")/.."

echo "[1/4] 拉取最新代码..."
git pull --ff-only || {
  echo "❌ git pull 失败（有本地改动或网络问题），处理后再试。"
  exit 1
}

echo "[2/4] 重建并重启容器（数据在 data/ 卷中，不受影响）..."
docker compose up -d --build

echo "[3/4] 等待服务启动..."
sleep 3

echo "[4/4] 健康检查..."
if curl -fsS http://localhost:4173/api/health > /dev/null 2>&1; then
  echo ""
  echo "✅ 更新成功：$(curl -fsS http://localhost:4173/api/health)"
  echo "   本次更新前的数据快照已自动存入 data/backups/"
else
  echo ""
  echo "❌ 健康检查未通过，查看日志：docker compose logs worklog"
  echo "   如需回滚：git checkout <上一个版本号> && docker compose up -d --build"
  exit 1
fi
