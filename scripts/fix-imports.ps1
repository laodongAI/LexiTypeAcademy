# DDD重构 - 批量修复import路径
Write-Host "开始批量修复import路径..." -ForegroundColor Green

# 获取所有TS/TSX文件
$files = Get-ChildItem -Path "src" -Include *.ts,*.tsx -Recurse -File

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $updated = $false
    
    # 修复models/course
    if ($content -match "from '\.\./models/course'") {
        $content = $content -replace "from '\.\./models/course'", "from '@/domain/models/course'"
        $updated = $true
    }
    if ($content -match "from '\.\./\.\./models/course'") {
        $content = $content -replace "from '\.\./\.\./models/course'", "from '@/domain/models/course'"
        $updated = $true
    }
    if ($content -match "from '\.\./\.\./\.\./models/course'") {
        $content = $content -replace "from '\.\./\.\./\.\./models/course'", "from '@/domain/models/course'"
        $updated = $true
    }
    
    # 修复types/learning
    if ($content -match "from '\.\./types/learning'") {
        $content = $content -replace "from '\.\./types/learning'", "from '@/domain/types/learning'"
        $updated = $true
    }
    if ($content -match "from '\.\./\.\./types/learning'") {
        $content = $content -replace "from '\.\./\.\./types/learning'", "from '@/domain/types/learning'"
        $updated = $true
    }
    
    # 修复services/db
    if ($content -match "from '\./db'") {
        $content = $content -replace "from '\./db'", "from '@/data/db'"
        $updated = $true
    }
    if ($content -match "from '\.\./services/db'") {
        $content = $content -replace "from '\.\./services/db'", "from '@/data/db'"
        $updated = $true
    }
    if ($content -match "from '\.\./db'") {
        $content = $content -replace "from '\.\./db'", "from '@/data/db'"
        $updated = $true
    }
    
    # 修复tts
    if ($content -match "from '\.\./tts'") {
        $content = $content -replace "from '\.\./tts'", "from '@/data/tts'"
        $updated = $true
    }
    if ($content -match "from '\.\./\.\./tts'") {
        $content = $content -replace "from '\.\./\.\./tts'", "from '@/data/tts'"
        $updated = $true
    }
    if ($content -match "from '\.\./services/tts'") {
        $content = $content -replace "from '\.\./services/tts'", "from '@/data/tts'"
        $updated = $true
    }
    if ($content -match "from '\.\./\.\./services/tts'") {
        $content = $content -replace "from '\.\./\.\./services/tts'", "from '@/data/tts'"
        $updated = $true
    }
    
    # 修复asr
    if ($content -match "from '\.\./asr'") {
        $content = $content -replace "from '\.\./asr'", "from '@/data/asr'"
        $updated = $true
    }
    if ($content -match "from '\.\./\.\./asr'") {
        $content = $content -replace "from '\.\./\.\./asr'", "from '@/data/asr'"
        $updated = $true
    }
    if ($content -match "from '\.\./services/asr'") {
        $content = $content -replace "from '\.\./services/asr'", "from '@/data/asr'"
        $updated = $true
    }
    
    # 修复config
    if ($content -match "from '\.\./config/") {
        $content = $content -replace "from '\.\./config/", "from '@/shared/constants/"
        $updated = $true
    }
    if ($content -match "from '\.\./\.\./config/") {
        $content = $content -replace "from '\.\./\.\./config/", "from '@/shared/constants/"
        $updated = $true
    }
    if ($content -match "from '\.\./\.\./\.\./config/") {
        $content = $content -replace "from '\.\./\.\./\.\./config/", "from '@/shared/constants/"
        $updated = $true
    }
    
    # 修复utils
    if ($content -match "from '\.\./utils/") {
        $content = $content -replace "from '\.\./utils/", "from '@/shared/utils/"
        $updated = $true
    }
    if ($content -match "from '\.\./\.\./utils/") {
        $content = $content -replace "from '\.\./\.\./utils/", "from '@/shared/utils/"
        $updated = $true
    }
    if ($content -match "from '\.\./\.\./\.\./utils/") {
        $content = $content -replace "from '\.\./\.\./\.\./utils/", "from '@/shared/utils/"
        $updated = $true
    }
    
    # 修复di
    if ($content -match "from '\.\./services/di/") {
        $content = $content -replace "from '\.\./services/di/", "from '@/di/"
        $updated = $true
    }
    if ($content -match "from '\.\./\.\./services/di/") {
        $content = $content -replace "from '\.\./\.\./services/di/", "from '@/di/"
        $updated = $true
    }
    if ($content -match "from '\.\./di/") {
        $content = $content -replace "from '\.\./di/", "from '@/di/"
        $updated = $true
    }
    if ($content -match "from '\.\./\.\./di/") {
        $content = $content -replace "from '\.\./\.\./di/", "from '@/di/"
        $updated = $true
    }
    
    # 修复logger
    if ($content -match "from '\.\./logger/") {
        $content = $content -replace "from '\.\./logger/", "from '@/data/storage/logger/"
        $updated = $true
    }
    if ($content -match "from '\.\./\.\./logger/") {
        $content = $content -replace "from '\.\./\.\./logger/", "from '@/data/storage/logger/"
        $updated = $true
    }
    
    # 修复audio相关路径
    if ($content -match "from '\.\./audio/") {
        $content = $content -replace "from '\.\./audio/", "from '@/data/audio/"
        $updated = $true
    }
    if ($content -match "from '\.\./\.\./audio/") {
        $content = $content -replace "from '\.\./\.\./audio/", "from '@/data/audio/"
        $updated = $true
    }
    if ($content -match "from '\.\./services/audio/") {
        $content = $content -replace "from '\.\./services/audio/", "from '@/data/audio/"
        $updated = $true
    }
    if ($content -match "from '\.\./\.\./services/audio/") {
        $content = $content -replace "from '\.\./\.\./services/audio/", "from '@/data/audio/"
        $updated = $true
    }
    if ($content -match "from '\.\./\.\./\.\./services/audio/") {
        $content = $content -replace "from '\.\./\.\./\.\./services/audio/", "from '@/data/audio/"
        $updated = $true
    }
    
    # 修复其他services
    if ($content -match "from '\.\./services/learningProgressStore'") {
        $content = $content -replace "from '\.\./services/learningProgressStore'", "from '@/data/storage/learningProgressStore'"
        $updated = $true
    }
    if ($content -match "from '\.\./services/favoritesStore'") {
        $content = $content -replace "from '\.\./services/favoritesStore'", "from '@/data/storage/favoritesStore'"
        $updated = $true
    }
    if ($content -match "from '\.\./services/reviewVault'") {
        $content = $content -replace "from '\.\./services/reviewVault'", "from '@/data/storage/reviewVault'"
        $updated = $true
    }
    if ($content -match "from '\.\./services/unifiedPractice'") {
        $content = $content -replace "from '\.\./services/unifiedPractice'", "from '@/data/audio/unifiedPractice'"
        $updated = $true
    }
    
    # 保存修改
    if ($updated) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
        Write-Host "✓ $($file.FullName)" -ForegroundColor Yellow
    }
}

Write-Host "`n修复完成!" -ForegroundColor Green
