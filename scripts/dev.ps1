# ============================================================================
# LexiType Academy 本地开发启动脚本（Windows / PowerShell）
#
# 作用：
#   1. 校验 Python 与 Node 环境
#   2. 首次运行时自动创建 backend/.venv 并安装后端依赖
#   3. 执行模型资产自检（可选跳过）
#   4. 分别在新窗口启动后端（127.0.0.1:8000）与前端（localhost:5173）
#
# 用法：
#   .\scripts\dev.ps1                  # 完整启动（含模型自检）
#   .\scripts\dev.ps1 -SkipModels      # 跳过模型自检
#   .\scripts\dev.ps1 -BackendOnly     # 仅启动后端
#   .\scripts\dev.ps1 -FrontendOnly    # 仅启动前端
# ============================================================================

[CmdletBinding()]
param(
    # 跳过模型资产自检（模型尚未拷贝时可临时使用）
    [switch]$SkipModels,
    # 仅启动后端服务
    [switch]$BackendOnly,
    # 仅启动前端页面
    [switch]$FrontendOnly
)

# 脚本执行失败即中止，避免带病继续启动
$ErrorActionPreference = 'Stop'

# 项目根目录：脚本位于 scripts/，上一级即仓库根
$ProjectRoot = Split-Path -Parent $PSScriptRoot
# 后端目录
$BackendDir = Join-Path $ProjectRoot 'backend'
# 前端目录
$FrontendDir = Join-Path $ProjectRoot 'frontend'
# 后端虚拟环境目录
$VenvDir = Join-Path $BackendDir '.venv'
# 虚拟环境内的 Python 解释器
$VenvPython = Join-Path $VenvDir 'Scripts\python.exe'
# 后端依赖清单
$RequirementsFile = Join-Path $BackendDir 'requirements.txt'
# 模型自检脚本
$CheckModelsScript = Join-Path $ProjectRoot 'scripts\check_models.py'

# ---------------------------------------------------------------------------
# 工具函数：带时间戳的分级日志输出
# ---------------------------------------------------------------------------
function Write-Step {
    param([string]$Message)
    Write-Host ("[{0}] [INFO ] {1}" -f (Get-Date -Format 'HH:mm:ss'), $Message) -ForegroundColor Cyan
}

function Write-Warn {
    param([string]$Message)
    Write-Host ("[{0}] [WARN ] {1}" -f (Get-Date -Format 'HH:mm:ss'), $Message) -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host ("[{0}] [ERROR] {1}" -f (Get-Date -Format 'HH:mm:ss'), $Message) -ForegroundColor Red
}

# ---------------------------------------------------------------------------
# 1. 环境校验
# ---------------------------------------------------------------------------
function Test-Prerequisites {
    Write-Step '校验运行环境...'

    # Python 可用性
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCmd) {
        throw '未找到 python，请先安装 Python 3.11+ 并加入 PATH'
    }

    # 仅启动后端时才需要 Node
    if (-not $FrontendOnly) {
        return
    }
    Test-NodeAvailable
}

function Test-NodeAvailable {
    # Node 与 npm 可用性（前端启动必需）
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $nodeCmd -or -not $npmCmd) {
        throw '未找到 node/npm，请先安装 Node.js 18+ 并加入 PATH'
    }
}

# ---------------------------------------------------------------------------
# 2. 后端虚拟环境与依赖
# ---------------------------------------------------------------------------
function Initialize-BackendEnv {
    Write-Step '检查后端虚拟环境...'

    # 首次运行：创建虚拟环境
    if (-not (Test-Path $VenvPython)) {
        Write-Step "创建虚拟环境：$VenvDir"
        python -m venv $VenvDir
        if ($LASTEXITCODE -ne 0) {
            throw '创建虚拟环境失败'
        }
    }

    # 安装/更新依赖（依赖清单变更时重新安装）
    Write-Step '安装后端依赖（requirements.txt）...'
    & $VenvPython -m pip install --upgrade pip --quiet
    & $VenvPython -m pip install -r $RequirementsFile --quiet
    if ($LASTEXITCODE -ne 0) {
        throw '后端依赖安装失败'
    }
    Write-Step '后端依赖就绪'
}

# ---------------------------------------------------------------------------
# 3. 模型资产自检
# ---------------------------------------------------------------------------
function Invoke-ModelCheck {
    # 显式跳过时不执行
    if ($SkipModels) {
        Write-Warn '已跳过模型自检（-SkipModels）'
        return
    }

    Write-Step '执行模型资产自检...'
    # 使用后端虚拟环境执行，保证依赖一致
    & $VenvPython $CheckModelsScript
    if ($LASTEXITCODE -ne 0) {
        Write-Warn '模型自检未通过：必需模型缺失，相关语音能力将不可用'
        Write-Warn '请按 backend/models/manifest.json 声明的目录结构拷贝模型后重试'
    }
}

# ---------------------------------------------------------------------------
# 4. 启动服务
# ---------------------------------------------------------------------------
function Start-Backend {
    Write-Step '启动后端：http://127.0.0.1:8000'
    # 新窗口启动，便于单独观察后端日志与停止
    Start-Process -FilePath $VenvPython `
        -ArgumentList '-m', 'app.main' `
        -WorkingDirectory $BackendDir `
        -WindowStyle Normal
}

function Start-Frontend {
    Test-NodeAvailable
    Write-Step '启动前端：http://localhost:5173'

    # 首次运行：安装前端依赖
    $NodeModules = Join-Path $FrontendDir 'node_modules'
    if (-not (Test-Path $NodeModules)) {
        Write-Step '前端依赖未安装，开始 npm install（首次较慢）...'
        Push-Location $FrontendDir
        try {
            npm install
            if ($LASTEXITCODE -ne 0) {
                throw '前端依赖安装失败'
            }
        }
        finally {
            Pop-Location
        }
    }

    # 新窗口启动 Vite 开发服务器
    Start-Process -FilePath 'cmd.exe' `
        -ArgumentList '/c', 'npm run dev' `
        -WorkingDirectory $FrontendDir `
        -WindowStyle Normal
}

# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
try {
    Write-Step "项目根目录：$ProjectRoot"

    Test-Prerequisites

    if (-not $FrontendOnly) {
        Initialize-BackendEnv
        Invoke-ModelCheck
        Start-Backend
    }

    if (-not $BackendOnly) {
        Start-Frontend
    }

    Write-Step '启动完成'
    Write-Host ''
    Write-Host '  后端接口文档 : http://127.0.0.1:8000/docs' -ForegroundColor Green
    Write-Host '  后端健康检查 : http://127.0.0.1:8000/api/health' -ForegroundColor Green
    Write-Host '  前端页面     : http://localhost:5173' -ForegroundColor Green
    Write-Host ''
    Write-Step '停止服务：关闭对应命令行窗口，或按 Ctrl+C'
}
catch {
    Write-Err $_.Exception.Message
    exit 1
}
