$ErrorActionPreference = "Stop"

$sourceDir = $PSScriptRoot
$destZip = Join-Path (Split-Path $sourceDir -Parent) "WebHybrid_Deploy.zip"

Write-Host "Đang chuẩn bị danh sách file để đóng gói..." -ForegroundColor Cyan

if (Test-Path $destZip) {
    Remove-Item $destZip -Force
}

$excludeFolders = @("node_modules", ".next", ".git", ".agents", ".scratch", "test-results", "TaiLieu", "crawler\node_modules")

$allFiles = Get-ChildItem -Path $sourceDir -Recurse -File | Where-Object {
    $filePath = $_.FullName
    $skip = $false
    foreach ($folder in $excludeFolders) {
        if ($filePath -like "*\$folder\*" -or $filePath -like "*/$folder/*") {
            $skip = $true
            break
        }
    }
    -not $skip
}

Write-Host "Đang nén $($allFiles.Count) files mã nguồn vào $destZip..." -ForegroundColor Yellow
$tempDir = Join-Path $env:TEMP "WebHybrid_Temp_Package"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir | Out-Null

foreach ($file in $allFiles) {
    $relPath = [System.IO.Path]::GetRelativePath($sourceDir, $file.FullName)
    $targetFile = Join-Path $tempDir $relPath
    $targetDir = Split-Path $targetFile -Parent
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }
    Copy-Item $file.FullName -Destination $targetFile -Force
}

Compress-Archive -Path "$tempDir\*" -DestinationPath $destZip -CompressionLevel Optimal
Remove-Item $tempDir -Recurse -Force

$sizeMB = [math]::Round((Get-Item $destZip).Length / 1MB, 2)
Write-Host "===============================================================" -ForegroundColor Green
Write-Host " [THÀNH CÔNG] ĐÃ TẠO FILE NÉN SIÊU NHẸ!" -ForegroundColor Green
Write-Host " Vị trí file: $destZip" -ForegroundColor Green
Write-Host " Dung lượng:  $sizeMB MB (Giảm từ ~5000 MB xuống $sizeMB MB)" -ForegroundColor Green
Write-Host "===============================================================" -ForegroundColor Green
