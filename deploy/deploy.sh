#!/usr/bin/env bash
# ============================================================
# 财务管家 · 前端发版脚本（在 ECS 上执行）
#
# 用法：
#   sudo ./deploy.sh /tmp/dist.tar.gz
#
# 做的事：
#   1. 解压到 /var/www/finance/releases/<时间戳>
#   2. 修正权限（nginx 需要可读）
#   3. 原子切换 current 软链接
#   4. 校验 Nginx 配置并热加载
#   5. 只保留最近 N 个版本，旧的自动清理
#
# 回滚：把 current 指回上一个 releases 目录即可，见 --rollback
# ============================================================
set -euo pipefail

APP_DIR="/var/www/finance"
KEEP_RELEASES=5
NGINX_USER="nginx"   # Ubuntu 上通常是 www-data，按需修改

usage() {
  echo "用法: $0 <dist.tar.gz>"
  echo "      $0 --rollback"
  exit 1
}

# ---------- 回滚：切到上一个版本 ----------
if [[ "${1:-}" == "--rollback" ]]; then
  PREV=$(ls -1dt "$APP_DIR"/releases/* 2>/dev/null | sed -n '2p')
  if [[ -z "$PREV" ]]; then
    echo "✗ 没有可回滚的历史版本"
    exit 1
  fi
  ln -sfn "$PREV" "$APP_DIR/current"
  nginx -t && systemctl reload nginx
  echo "✓ 已回滚到 $PREV"
  exit 0
fi

TARBALL="${1:-}"
[[ -f "$TARBALL" ]] || usage

# ---------- 准备 ----------
command -v nginx >/dev/null || { echo "✗ 未安装 nginx"; exit 1; }
STAMP=$(date +%Y%m%d%H%M%S)
RELEASE="$APP_DIR/releases/$STAMP"

mkdir -p "$RELEASE"

echo "→ 解压到 $RELEASE"
tar -xzf "$TARBALL" -C "$RELEASE"

# 入口文件必须存在，避免把空包/坏包发上去
if [[ ! -f "$RELEASE/index.html" ]]; then
  echo "✗ 包内没有 index.html，可能不是 dist 产物"
  rm -rf "$RELEASE"
  exit 1
fi

# ---------- 权限 ----------
chown -R root:root "$RELEASE"
find "$RELEASE" -type d -exec chmod 755 {} \;
find "$RELEASE" -type f -exec chmod 644 {} \;

# nginx 用户需要能进入上层目录
chmod 755 "$APP_DIR" "$APP_DIR/releases"

# SELinux（Alibaba Cloud Linux / CentOS）需要打标签，否则 403
if command -v getenforce >/dev/null && [[ "$(getenforce)" == "Enforcing" ]]; then
  chcon -R -t httpd_sys_content_t "$RELEASE" || true
  echo "→ SELinux 已启用，已为静态目录打标签"
fi

# ---------- 原子切换 ----------
ln -sfn "$RELEASE" "$APP_DIR/current"
echo "→ current -> $RELEASE"

# ---------- 热加载 ----------
if nginx -t; then
  systemctl reload nginx
else
  echo "✗ Nginx 配置校验失败，已回退软链接"
  PREV=$(ls -1dt "$APP_DIR"/releases/* | sed -n '2p')
  [[ -n "$PREV" ]] && ln -sfn "$PREV" "$APP_DIR/current"
  exit 1
fi

# ---------- 清理旧版本 ----------
COUNT=$(ls -1d "$APP_DIR"/releases/* | wc -l)
if (( COUNT > KEEP_RELEASES )); then
  ls -1dt "$APP_DIR"/releases/* | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
  echo "→ 已清理旧版本，保留最近 $KEEP_RELEASES 个"
fi

echo "✓ 发版完成: $RELEASE"
