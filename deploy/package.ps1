# ============================================================
# 财务管家 · 本地打包脚本（Windows PowerShell）
#
# 用法：
#   deploy\package.cmd              # 推荐：双击或命令行，自动放开执行策略
#   powershell -ExecutionPolicy Bypass -File deploy\package.ps1
#   powershell ... -File deploy\package.ps1 -Clean   # 干净安装依赖再打包
#
# 做的事：
#   1. 校验生产环境变量（必须关闭 mock）
#   2. 按需安装依赖（默认复用 node_modules，-Clean 时 npm ci）
#   3. 构建 + 校验产物里没有 mock 代码
#   4. 打成 dist.tar.gz，方便 scp 上服务器
# ============================================================
param(
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'

# 切到仓库根目录（脚本在 deploy/ 下）
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host '→ 校验 .env.production ...' -ForegroundColor Cyan
$envFile = Join-Path $root '.env.production'
if (-not (Test-Path $envFile)) { throw '缺少 .env.production' }
if ((Get-Content $envFile -Raw) -notmatch 'VITE_USE_MOCK=false') {
    throw '.env.production 中 VITE_USE_MOCK 必须为 false，否则生产包会带 mock 数据'
}

if ($Clean -or -not (Test-Path (Join-Path $root 'node_modules'))) {
    Write-Host '→ 安装依赖（npm ci）...' -ForegroundColor Cyan
    Write-Host '  提示：npm ci 会重建 node_modules，执行前请先关闭 dev server' -ForegroundColor DarkYellow
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci 失败：请先关闭 npm run dev / vite 进程后重试' }
} else {
    Write-Host '→ 复用现有 node_modules（如需干净安装请加 -Clean）' -ForegroundColor DarkGray
}

Write-Host '→ 构建...' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw '构建失败' }
if (-not (Test-Path (Join-Path $root 'dist/index.html'))) { throw '构建失败：没有生成 dist/index.html' }

Write-Host '→ 校验产物（不应包含 mock 代码）...' -ForegroundColor Cyan
$leak = Select-String -Path 'dist/assets/*.js' -Pattern 'admin123', 'personal-finance.mock' -SimpleMatch -ErrorAction SilentlyContinue
if ($leak) { throw "产物里发现 mock 代码，检查 VITE_USE_MOCK：$($leak[0].Filename)" }

Write-Host '→ 打包 dist.tar.gz ...' -ForegroundColor Cyan
$tar = Join-Path $root 'dist.tar.gz'
if (Test-Path $tar) { Remove-Item $tar -Force }
tar -czf $tar -C (Join-Path $root 'dist') .
if ($LASTEXITCODE -ne 0) { throw 'tar 打包失败（Windows 10+ 自带 tar，请确认可用）' }

$size = [math]::Round((Get-Item $tar).Length / 1KB)
Write-Host ''
Write-Host "✓ 打包完成：$tar（$size KB）" -ForegroundColor Green
Write-Host '  下一步：scp dist.tar.gz root@<ECS_IP>:/tmp/' -ForegroundColor Yellow
Write-Host '  服务器：sudo bash deploy/deploy.sh /tmp/dist.tar.gz' -ForegroundColor Yellow
