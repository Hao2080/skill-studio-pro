[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Root,

    [string]$EvidenceName = "external-files-after-scan.json"
)

$ErrorActionPreference = "Stop"
$requiredLeafPrefix = "Skill-Studio-Pro-Task2-UAT-"
$resolvedRoot = [System.IO.Path]::GetFullPath($Root)
if (-not ([System.IO.Path]::GetFileName($resolvedRoot).StartsWith($requiredLeafPrefix, [System.StringComparison]::Ordinal))) {
    throw "Refusing to inspect outside a dedicated Task 2 root: $resolvedRoot"
}

$rootPrefix = $resolvedRoot.TrimEnd('\') + '\'
$layoutPath = Join-Path $resolvedRoot "evidence\uat-layout.json"
$beforePath = Join-Path $resolvedRoot "evidence\external-files-before-scan.json"
$layout = Get-Content -LiteralPath $layoutPath -Raw | ConvertFrom-Json -AsHashtable
$before = @(Get-Content -LiteralPath $beforePath -Raw | ConvertFrom-Json -AsHashtable -DateKind String)

$trackedRoots = @($layout.platformScanRoots.Values) + @(
    (Join-Path $layout.home ".codex\plugins\cache\acme\1.0.0"),
    $layout.customScanRoot
)

$after = foreach ($trackedRoot in $trackedRoots) {
    $fullTrackedRoot = [System.IO.Path]::GetFullPath($trackedRoot)
    if (-not $fullTrackedRoot.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Tracked root escaped the UAT root: $fullTrackedRoot"
    }
    Get-ChildItem -LiteralPath $fullTrackedRoot -Recurse -File -Force |
        Where-Object { $_.FullName -notmatch '[\\/]\.git[\\/]' } |
        Sort-Object FullName |
        ForEach-Object {
            [ordered]@{
                path = $_.FullName
                length = $_.Length
                lastWriteTimeUtc = $_.LastWriteTimeUtc.ToString("O")
                sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
            }
        }
}

$afterPath = Join-Path $resolvedRoot "evidence\$EvidenceName"
[System.IO.File]::WriteAllText(
    $afterPath,
    ($after | ConvertTo-Json -Depth 5),
    [System.Text.UTF8Encoding]::new($false)
)

$beforeCanonical = @($before | ForEach-Object {
    $ticks = ([DateTimeOffset]::Parse([Convert]::ToString($_['lastWriteTimeUtc']))).UtcTicks
    "{0}`t{1}`t{2}`t{3}" -f $_['path'], $_['length'], $ticks, $_['sha256']
} | Sort-Object)
$afterCanonical = @($after | ForEach-Object {
    $ticks = ([DateTimeOffset]::Parse([Convert]::ToString($_['lastWriteTimeUtc']))).UtcTicks
    "{0}`t{1}`t{2}`t{3}" -f $_['path'], $_['length'], $ticks, $_['sha256']
} | Sort-Object)
$changes = @(Compare-Object -ReferenceObject $beforeCanonical -DifferenceObject $afterCanonical)
if ($changes.Count -gt 0) {
    throw "External scan files changed: $($changes | ConvertTo-Json -Depth 4 -Compress)"
}

[ordered]@{
    status = "PASS"
    fileCount = $after.Count
    beforeManifest = $beforePath
    afterManifest = $afterPath
    contentHashAndMtimeUnchanged = $true
} | ConvertTo-Json -Depth 4
