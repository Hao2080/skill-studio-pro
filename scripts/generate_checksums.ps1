# generate_checksums.ps1 - 生成 Release 产物的 SHA256 校验和文件
# 用法: .\generate_checksums.ps1 [-Path] <目录路径>
# 默认目录: .\dist

param(
    [string]$Path = ".\dist"
)

if (-not (Test-Path $Path -PathType Container)) {
    Write-Host "错误: 目录不存在: $Path" -ForegroundColor Red
    exit 1
}

$extensions = @("exe", "msi", "dmg", "AppImage", "deb")

Write-Host "正在扫描目录: $Path" -ForegroundColor Cyan
Write-Host "生成 SHA256 校验和..." -ForegroundColor Cyan
Write-Host ""

foreach ($ext in $extensions) {
    Get-ChildItem -Path $Path -Filter "*.$ext" -File -Recurse | ForEach-Object {
        $checksum = (Get-FileHash -Path $_.FullName -Algorithm SHA256).Hash
        $sumFile = "$($_.FullName).sha256"

        "$checksum  $($_.Name)" | Set-Content -Path $sumFile -Encoding UTF8

        Write-Host "生成: $sumFile" -ForegroundColor Green
        Write-Host "  文件: $($_.Name)"
        Write-Host "  SHA256: $checksum"
        Write-Host ""
    }
}

Write-Host "完成！所有校验和文件已生成。" -ForegroundColor Cyan
