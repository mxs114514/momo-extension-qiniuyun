$ErrorActionPreference = 'Stop'

$requiredFiles = @(
  'dist/manifest.json',
  'dist/side-panel.html',
  'dist/offscreen.html',
  'dist/speech-pcm-worklet.js',
  'dist/assets/background.js',
  'dist/icons/icon-16.png',
  'dist/icons/icon-32.png',
  'dist/icons/icon-48.png',
  'dist/icons/icon-128.png'
)

foreach ($file in $requiredFiles) {
  if (-not (Test-Path -Path $file)) {
    throw "扩展构建缺少文件：$file"
  }
}

Write-Host '扩展构建产物检查通过'
