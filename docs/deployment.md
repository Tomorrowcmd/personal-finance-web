# 前端部署指南（ECS + Nginx）

本文档面向**单台 ECS 同时跑前端静态资源 + 后端 API** 的部署方式：  
前端构建成 `dist/` 由 Nginx 托管，`/api` 反代到本机 Spring Boot。

> 前端是纯静态产物，服务器上**不需要安装 Node**。构建在本地完成，只上传 `dist`。

---

## 0. 部署架构

```
浏览器
  │  https://finance.example.com
  ▼
Nginx (ECS :443)
  ├─ /            → /var/www/finance/current  （前端静态文件）
  └─ /api/        → http://127.0.0.1:9081/api/ （Spring Boot）
                          │
                          ▼
                     PostgreSQL (127.0.0.1:5432)
```

- 前后端同域，**不需要配置 CORS**。
- 后端只监听 `127.0.0.1`，公网只能通过 Nginx 访问。
- `current` 是软链接，发版/回滚只切换它。

---

## 1. 前置准备

### 1.1 服务器

| 项  | 建议                                                |
| -- | ------------------------------------------------- |
| 规格 | 2 核 4G 起（前后端 + PostgreSQL 同机）；1 核 2G 只够前端 + 外部数据库 |
| 系统 | Alibaba Cloud Linux 3 / Ubuntu 22.04 / Debian 12  |
| 磁盘 | 40G 起（日志 + 备份会慢慢涨）                                |
| 时区 | `Asia/Shanghai`（后端按月统计依赖它）                        |

```bash
sudo timedatectl set-timezone Asia/Shanghai
```

### 1.2 安全组（阿里云控制台）

| 方向  | 端口          | 授权对象        | 说明                     |
| --- | ----------- | ----------- | ---------------------- |
| 入方向 | 22          | **你的固定 IP** | 不要对 `0.0.0.0/0` 开放 SSH |
| 入方向 | 80          | `0.0.0.0/0` | HTTP（跳转 HTTPS / 证书验证）  |
| 入方向 | 443         | `0.0.0.0/0` | HTTPS                  |
| 入方向 | 9081 / 5432 | ❌ 不开放       | 后端与数据库只走本机             |

### 1.3 域名与备案

- 域名解析到 ECS 公网 IP（A 记录）。
- **阿里云中国大陆地域**：域名通过 80/443 访问前必须完成 **ICP 备案**，否则会被拦截。  
  备案期间可以先用 `http://<公网IP>` 自测。

---

## 2. 本地构建与打包

### 2.1 环境

```json
"engines": { "node": "^22.18.0 || >=24.12.0" }
```

Node 版本不满足会直接报错（Vite 8 的要求）。

### 2.2 一键打包（推荐）

```powershell
deploy\package.cmd
```

Windows 默认禁止运行未签名 `.ps1`，`.cmd` 包装器会自动带上 `-ExecutionPolicy Bypass`，  
双击或在命令行执行都可以。

脚本会依次：校验 `.env.production` → 复用现有 `node_modules` → `npm run build` →  
检查产物里没有 mock 代码 → 生成 `dist.tar.gz`（约 280 KB）。

> 打包前请**关闭正在运行的 `npm run dev`**：默认不会重装依赖，但如果你手动执行  
> `npm ci`（或加 `-Clean`），它会重建 `node_modules`，被 dev server 占用会报 `EPERM`。

### 2.3 手动构建

```bash
npm ci            # 严格按 lockfile 安装
npm run build     # vue-tsc 类型检查 + vite build
```

产物在 `dist/`，约 **830 KB**（gzip 后约 290 KB，33 个文件）：

```
dist/
├─ index.html            # 入口，no-store
├─ favicon.svg
└─ assets/               # 带 hash 的 js/css，可长缓存
```

### 2.4 构建期变量（重要）

`VITE_*` 变量是在**构建时**注入到代码里的，改完必须重新 `npm run build`，  
仅修改服务器上的文件或重启 Nginx **不会生效**。

| 变量                  | 生产值     | 说明                           |
| ------------------- | ------- | ---------------------------- |
| `VITE_API_BASE_URL` | `/api`  | 与 Nginx 反代路径一致               |
| `VITE_USE_MOCK`     | `false` | 必须关闭，否则不会请求真实后端              |
| `API_PROXY_TARGET`  | 不配置     | 只影响 `vite preview`，生产走 Nginx |

### 2.5 上传前自测（建议）

```bash
npm run preview -- --port 4173
```

用生产构建跑一遍核心流程：登录 → 总览 → 记一笔 → 明细筛选/导出 → 统计 → 预算 → 分类 → 改密 → 退出。  
（`preview` 会把 `/api` 代理到本机 `9081`，需要后端已启动。）

---

## 3. 上传到服务器

```bash
# 本地
scp dist.tar.gz root@<ECS公网IP>:/tmp/
```

Windows 也可以用 WinSCP / MobaXterm 拖拽上传。

> 只上传 `dist.tar.gz`（约 100–300 KB），不要上传整个仓库。

---

## 4. 服务器初始化

### 4.1 安装 Nginx

```bash
# Alibaba Cloud Linux / CentOS / RHEL
sudo dnf install -y nginx

# Ubuntu / Debian
sudo apt update && sudo apt install -y nginx

nginx -v
```

### 4.2 目录结构

```bash
sudo mkdir -p /var/www/finance/releases
sudo mkdir -p /var/www/finance/current   # 会被软链接替换，先占位
sudo chmod 755 /var/www/finance /var/www/finance/releases
```

最终结构：

```
/var/www/finance/
├─ releases/
│  ├─ 20261030120000/
│  └─ 20261105103000/
└─ current -> releases/20261105103000
```

### 4.3 SELinux（Alibaba Cloud Linux / CentOS 必看）

```bash
getenforce
```

如果输出 `Enforcing`：

```bash
# 允许 Nginx 反代到本机端口（否则 502）
sudo setsebool -P httpd_can_network_connect on
# 允许 Nginx 读取 /var/www 下的静态文件（否则 403）
sudo chcon -R -t httpd_sys_content_t /var/www/finance
```

Ubuntu / Debian 默认没有 SELinux，可跳过。

### 4.4 防火墙

```bash
# 如果启用了 firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

阿里云以**安全组**为主，firewalld 未启用时无需处理。

---

## 5. 配置 Nginx

仓库里的模板：[`deploy/nginx.conf`](../deploy/nginx.conf)。

```bash
sudo cp deploy/nginx.conf /etc/nginx/conf.d/finance.conf
sudo vi /etc/nginx/conf.d/finance.conf
```

需要改的地方：

| 占位                                      | 改成                    |
| --------------------------------------- | --------------------- |
| `finance.example.com`                   | 你的域名                  |
| `/etc/nginx/ssl/finance.pem` / `.key`   | 实际证书路径                |
| `proxy_pass http://127.0.0.1:9081/api/` | 后端实际端口（保持 `/api/` 结尾） |
| `/var/www/finance/current`              | 如果换了目录，同步改 `root`     |

**没有证书时先跑 HTTP**：把 `listen 443 ssl` 那段注释掉，把 80 的 `return 301` 换成静态配置，  
先验证访问正常，再补 HTTPS。

```bash
sudo nginx -t          # 必须 OK 才能 reload
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

### 5.1 Nginx 配置里的关键点

| 配置                                    | 作用           | 漏了会怎样                |
| ------------------------------------- | ------------ | -------------------- |
| `try_files $uri $uri/ /index.html`    | SPA 路由回退     | 刷新 `/records` 直接 404 |
| `location = /index.html { no-store }` | 发版立即生效       | 用户看到旧页面              |
| `location /assets/ { immutable }`     | 静态资源长缓存      | 每次刷新重新下载             |
| `proxy_pass ...:9081/api/`            | 保留 `/api` 前缀 | 接口 404（路径变成 `/ping`） |
| `client_max_body_size`                | 限制上传体积       | 大请求 413              |

---

## 6. 配置 HTTPS

任选一种：

**A. 阿里云证书（推荐，免维护续期）**

1. 控制台 → 数字证书管理服务 → 申请免费证书（DV）
2. 下载 **Nginx** 格式，得到 `.pem` 和 `.key`
3. 上传到 `/etc/nginx/ssl/`，在配置里引用

**B. Let's Encrypt（certbot）**

```bash
sudo dnf install -y certbot python3-certbot-nginx   # 或 apt
sudo certbot --nginx -d finance.example.com
```

certbot 会自动改 Nginx 配置并加续期定时任务，`certbot renew --dry-run` 可验证。

配好后：

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -I https://finance.example.com
```

---

## 7. 后端服务（systemd）

模板：[`deploy/finance-api.service`](../deploy/finance-api.service)。

```bash
# 1) 低权限用户
sudo useradd -r -s /sbin/nologin finance || true
sudo mkdir -p /opt/finance/logs
sudo chown -R finance:finance /opt/finance

# 2) 上传 jar
sudo cp finance-api.jar /opt/finance/app.jar
sudo chown finance:finance /opt/finance/app.jar

# 3) 安装服务
sudo cp deploy/finance-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now finance-api

# 4) 检查
sudo systemctl status finance-api
curl -i http://127.0.0.1:9081/api/categories   # 期望 401（未登录）
```

关键点：

- `SERVER_PORT=9081`、`SERVER_ADDRESS=127.0.0.1`：只监听本机，公网必须经 Nginx。
- `TZ=Asia/Shanghai`：与前端日期口径一致。
- 日志：`journalctl -u finance-api -f`。

---

## 8. 发版与回滚

### 8.1 用脚本（推荐）

```bash
# 上传后，在服务器上执行（脚本需从仓库拷过去，或手写一次）
sudo bash deploy.sh /tmp/dist.tar.gz
```

脚本会：解压到新 release → 修权限（含 SELinux 标签）→ 切 `current` → `nginx -t` 并 reload → 只保留最近 5 个版本。

### 8.2 手动发版（等效）

```bash
STAMP=$(date +%Y%m%d%H%M%S)
sudo mkdir -p /var/www/finance/releases/$STAMP
sudo tar -xzf /tmp/dist.tar.gz -C /var/www/finance/releases/$STAMP
sudo chown -R root:root /var/www/finance/releases/$STAMP
sudo find /var/www/finance/releases/$STAMP -type d -exec chmod 755 {} \;
sudo find /var/www/finance/releases/$STAMP -type f -exec chmod 644 {} \;
sudo ln -sfn /var/www/finance/releases/$STAMP /var/www/finance/current
sudo nginx -t && sudo systemctl reload nginx
```

### 8.3 回滚

```bash
sudo bash deploy.sh --rollback
# 或手动：
sudo ln -sfn /var/www/finance/releases/<上一个版本> /var/www/finance/current
sudo nginx -t && sudo systemctl reload nginx
```

前端回滚不会影响后端数据，秒级完成。

---

## 9. 上线验证清单

```bash
# 1. 首页可访问、证书正常
curl -I https://finance.example.com

# 2. 未登录时接口返回 401（说明反代通了）
curl -i https://finance.example.com/api/categories

# 3. 静态资源缓存头
curl -I https://finance.example.com/assets/<某个hash文件>.js
#    期望：Cache-Control: public, immutable

# 4. 入口页不缓存
curl -I https://finance.example.com/index.html
#    期望：Cache-Control: no-store
```

浏览器侧：

- [ ] 打开域名自动跳 `/login`
- [ ] 登录成功后进入总览，右上角显示用户名
- [ ] 刷新任意页面（如 `/records`）不 404
- [ ] 记一笔 → 总览数据变化
- [ ] 明细筛选 / 分页 / 导出 Excel 正常
- [ ] 统计、预算、分类页均能打开
- [ ] 修改密码、退出登录正常
- [ ] 手机浏览器打开，底部标签栏可用

---

## 10. 常见问题排查

| 现象                 | 原因                        | 处理                                                                         |
| ------------------ | ------------------------- | -------------------------------------------------------------------------- |
| 502 Bad Gateway    | 后端没启动 / 端口不对 / SELinux 拦截 | `systemctl status finance-api`；`setsebool -P httpd_can_network_connect on` |
| 403 Forbidden      | 文件权限或 SELinux 标签          | `chmod 755/644`；`chcon -R -t httpd_sys_content_t`                          |
| 接口 404，路径少了 `/api` | `proxy_pass` 结尾漏了 `/api/` | 改成 `http://127.0.0.1:9081/api/`                                            |
| 刷新子页面 404          | 缺 SPA 回退                  | 加 `try_files $uri $uri/ /index.html`                                       |
| 发版后仍是旧页面           | `index.html` 被缓存          | 确认 `Cache-Control: no-store`，强制刷新验证                                        |
| 改了 `.env` 没变化      | `VITE_*` 是构建期注入           | 重新 `npm run build` 再上传                                                     |
| 登录提示「无法连接后端服务」     | 反代没通 / 后端未启动              | `curl -i http://127.0.0.1:9081/api/categories`                             |
| 登录 401 循环          | 后端 context-path 不是 `/api` | 与 `proxy_pass` 对齐                                                          |
| 静态资源 404           | `root` 指错目录               | 确认 `root /var/www/finance/current`                                         |
| 站点打开是 Nginx 欢迎页    | 默认 server 抢先匹配            | 删除 `/etc/nginx/conf.d/default.conf` 或调整 `server_name`                      |

查看日志：

```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
sudo journalctl -u finance-api -n 100 --no-pager
```

---

## 11. 可选优化

- **CDN / OSS**：静态资源可放 OSS + CDN，但 `/api` 仍需同域反代（OSS 不做反代，需保留 ECS 上的 Nginx）。
- **HTTP/2 + Brotli**：Nginx 已开 HTTP/2；Brotli 需要额外模块（`ngx_brotli`），可选。
- **日志切割**：Nginx 默认带 logrotate，检查 `/etc/logrotate.d/nginx` 保留天数。
- **数据库备份**：`pg_dump` + crontab，每日一次、保留 7 天，配合 ECS 快照。
- **监控**：`curl -fsS https://域名/ -o /dev/null` 定时探测；后端可暴露 `/actuator/health`。
- **CI/CD**：GitHub Actions / 阿里云效，构建后 rsync 到服务器并执行 `deploy.sh`。

---

## 12. 附：环境变量与构建命令速查

| 命令                     | 用途                           |
| ---------------------- | ---------------------------- |
| `npm ci`               | 按 lockfile 安装依赖（CI/发版用）      |
| `npm run build`        | 类型检查 + 生产构建                  |
| `npm run preview`      | 本地预览生产包（带 `/api` 代理）         |
| `npm run lint:check`   | ESLint 检查（不自动修复）             |
| `npm run format:check` | Prettier 格式检查                |
| `npm test`             | 运行工具函数单测                     |
| `deploy\package.cmd`   | 一键打包 `dist.tar.gz`（自动放开执行策略） |
| `deploy\package.ps1`   | 打包脚本本体，支持 `-Clean` 干净安装      |

| 文件                           | 用途                 |
| ---------------------------- | ------------------ |
| `deploy/package.cmd`         | 双击/命令行一键打包（推荐）     |
| `deploy/package.ps1`         | 打包脚本本体，支持 `-Clean` |
| `deploy/deploy.sh`           | 服务器发版 / 回滚         |
| `deploy/nginx.conf`          | Nginx 站点模板         |
| `deploy/finance-api.service` | 后端 systemd 单元      |
