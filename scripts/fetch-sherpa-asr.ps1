param(
  [string]$Version = "v1.12.17",
  [string]$DestDir = "E:\project\lexitype-academy\public\sherpa"
)

# 简化版本：不调用 GitHub API，直接按指定版本与固定资产名下载
$WasmZipName = "sherpa-onnx-wasm-simd-asr.zip"
$ModelZipName = "sherpa-onnx-paraformer-english-2023-xx-xx.zip"

$targetDir = Join-Path $DestDir "sherpa-onnx-wasm-simd-$Version-en-asr"
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

$wasmUrl = "https://github.com/k2-fsa/sherpa-onnx/releases/download/$Version/$WasmZipName"
$modelUrl = "https://github.com/k2-fsa/sherpa-onnx/releases/download/$Version/$ModelZipName"

Write-Host "下载 WASM ASR: $wasmUrl" -ForegroundColor Cyan
curl.exe -L "$wasmUrl" -o (Join-Path $targetDir "wasm-asr.zip")
Write-Host "解压 WASM ASR" -ForegroundColor Cyan
Expand-Archive -Path (Join-Path $targetDir "wasm-asr.zip") -DestinationPath $targetDir -Force

Write-Host "下载英文模型: $modelUrl" -ForegroundColor Cyan
curl.exe -L "$modelUrl" -o (Join-Path $targetDir "model.zip")
Write-Host "解压英文模型" -ForegroundColor Cyan
Expand-Archive -Path (Join-Path $targetDir "model.zip") -DestinationPath $targetDir -Force

Write-Host "完成。目标目录: $targetDir" -ForegroundColor Green
Write-Host "若下载失败，可能是资产文件名不同，请到 Releases 页面确认并修改脚本中的文件名变量。" -ForegroundColor Yellow
