# LexiType Academy DDD重构 - Import路径迁移脚本
# 用于批量更新旧import路径为新DDD路径

Write-Host "开始DDD架构导入路径迁移..." -ForegroundColor Green

# 定义路径映射规则
$pathMappings = @{
    # models -> @domain/models
    "from '../models/course'" = "from '@domain/models/course'"
    "from '../../models/course'" = "from '@domain/models/course'"
    "from '../../../models/course'" = "from '@domain/models/course'"
    
    # services/db -> @data/db
    "from '../services/db'" = "from '@data/db'"
    "from '../../services/db'" = "from '@data/db'"
    "from '../../../services/db'" = "from '@data/db'"
    
    # services/tts -> @data/tts
    "from '../services/tts'" = "from '@data/tts'"
    "from '../../services/tts'" = "from '@data/tts'"
    "from '../../../services/tts'" = "from '@data/tts'"
    
    # services/asr -> @data/asr
    "from '../services/asr'" = "from '@data/asr'"
    "from '../../services/asr'" = "from '@data/asr'"
    "from '../../../services/asr'" = "from '@data/asr'"
    
    # services/aiService -> @app/ai
    "from '../services/aiService'" = "from '@app/ai/aiService'"
    "from '../../services/aiService'" = "from '@app/ai/aiService'"
    
    # i18n -> @shared  (or keep original path)
    # utils -> @shared/utils
    "from '../utils/" = "from '@shared/utils/"
    "from '../../utils/" = "from '@shared/utils/"
    "from '../../../utils/" = "from '@shared/utils/"
    
    # hooks -> @shared/hooks
    "from '../hooks/" = "from '@shared/hooks/"
    "from '../../hooks/" = "from '@shared/hooks/"
    
    # config -> @shared/constants
    "from '../config/" = "from '@shared/constants/"
    "from '../../config/" = "from '@shared/constants/"
    
    # types -> @domain/types
    "from '../types/learning'" = "from '@domain/types/learning'"
    "from '../../types/learning'" = "from '@domain/types/learning'"
    
    # context -> keep in src/context for now (will move later)
}

# 获取所有需要更新的TS/TSX文件
$files = Get-ChildItem -Path "src" -Include *.ts,*.tsx -Recurse -File | 
    Where-Object { $_.FullName -notlike "*\node_modules\*" }

$totalFiles = $files.Count
$updatedFiles = 0

Write-Host "找到 $totalFiles 个文件需要检查..."

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    $fileUpdated = $false
    
    # 应用所有路径映射
    foreach ($mapping in $pathMappings.GetEnumerator()) {
        if ($content -match [regex]::Escape($mapping.Key)) {
            $content = $content -replace [regex]::Escape($mapping.Key), $mapping.Value
            $fileUpdated = $true
        }
    }
    
    # 如果文件有修改,保存
    if ($fileUpdated) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
        $updatedFiles++
        Write-Host "✓ 已更新: $($file.FullName)" -ForegroundColor Yellow
    }
}

Write-Host "`n迁移完成!" -ForegroundColor Green
Write-Host "共更新了 $updatedFiles / $totalFiles 个文件" -ForegroundColor Cyan

Write-Host "`n下一步操作:" -ForegroundColor Magenta
Write-Host "1. 运行 npm run typecheck 检查类型错误"
Write-Host "2. 手动修复剩余的路径问题"
Write-Host "3. 测试编译: npm run build:renderer"
