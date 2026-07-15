[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Root,

    [Parameter(Mandatory = $true)]
    [string]$Repository
)

$ErrorActionPreference = "Stop"
$rootPath = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
if (-not ([System.IO.Path]::GetFileName($rootPath).StartsWith("Skill-Studio-Pro-Task2-UAT-", [System.StringComparison]::Ordinal))) {
    throw "Refusing to benchmark outside a dedicated Task 2 UAT root: $rootPath"
}
$repositoryPath = [System.IO.Path]::GetFullPath($Repository).TrimEnd('\')
$manifest = Join-Path $repositoryPath "src-tauri\Cargo.toml"
if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) {
    throw "Cargo manifest is missing: $manifest"
}

$evidence = Join-Path $rootPath "evidence"
$stdout = Join-Path $evidence "55-inventory-benchmark.stdout.log"
$stderr = Join-Path $evidence "55-inventory-benchmark.stderr.log"
$benchmarkTemp = Join-Path $rootPath "temp"
[Environment]::SetEnvironmentVariable("TEMP", $benchmarkTemp, "Process")
[Environment]::SetEnvironmentVariable("TMP", $benchmarkTemp, "Process")

$arguments = @(
    "test",
    "--manifest-path", $manifest,
    "--release",
    "--test", "inventory_performance",
    "--", "--ignored", "--nocapture"
)
$startedAt = [DateTimeOffset]::UtcNow
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$process = Start-Process -FilePath "cargo" -ArgumentList $arguments -WorkingDirectory $repositoryPath -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
$peakWorkingSet = 0L
$peakProcessCount = 0

while (-not $process.HasExited) {
    $process.Refresh()
    $candidates = @(Get-CimInstance Win32_Process | Where-Object {
        $_.ProcessId -eq $process.Id -or
        $_.ParentProcessId -eq $process.Id -or
        ([string]$_.CommandLine).Contains("inventory_performance", [System.StringComparison]::OrdinalIgnoreCase)
    })
    $workingSet = 0L
    foreach ($candidate in $candidates) {
        $observed = Get-Process -Id $candidate.ProcessId -ErrorAction SilentlyContinue
        if ($observed) {
            $workingSet += $observed.WorkingSet64
        }
    }
    if ($workingSet -gt $peakWorkingSet) {
        $peakWorkingSet = $workingSet
        $peakProcessCount = $candidates.Count
    }
    Start-Sleep -Milliseconds 100
}
$process.WaitForExit()
$stopwatch.Stop()

$output = if (Test-Path -LiteralPath $stdout) { Get-Content -LiteralPath $stdout -Raw } else { "" }
$metric = [regex]::Match($output, "inventory_benchmark full_scan_ms=(\d+) incremental_scan_ms=(\d+) search_p95_ms=(\d+) detail_p95_ms=(\d+)")
$result = [ordered]@{
    command = "cargo " + ($arguments -join " ")
    exitCode = $process.ExitCode
    startedAt = $startedAt.ToString("O")
    elapsedMs = $stopwatch.ElapsedMilliseconds
    peakWorkingSetBytes = $peakWorkingSet
    peakObservedProcessCount = $peakProcessCount
    dataset = [ordered]@{ skills = 1000; files = 100000 }
    metrics = if ($metric.Success) {
        [ordered]@{
            fullScanMs = [int64]$metric.Groups[1].Value
            incrementalScanMs = [int64]$metric.Groups[2].Value
            searchP95Ms = [int64]$metric.Groups[3].Value
            detailP95Ms = [int64]$metric.Groups[4].Value
        }
    } else { $null }
    thresholds = if ($metric.Success) {
        [ordered]@{
            searchP95Under150Ms = [int64]$metric.Groups[3].Value -lt 150
            detailP95Under300Ms = [int64]$metric.Groups[4].Value -lt 300
        }
    } else { $null }
    stdout = $stdout
    stderr = $stderr
}
$resultPath = Join-Path $evidence "55-inventory-benchmark-result.json"
[System.IO.File]::WriteAllText($resultPath, ($result | ConvertTo-Json -Depth 7), [System.Text.UTF8Encoding]::new($false))
$result | ConvertTo-Json -Depth 7
if ($process.ExitCode -ne 0 -or -not $metric.Success) {
    exit 1
}
