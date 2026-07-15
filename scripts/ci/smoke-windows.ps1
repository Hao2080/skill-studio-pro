[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Installer,

    [Parameter(Mandatory = $true)]
    [string]$Output
)

$ErrorActionPreference = "Stop"
$installerPath = [System.IO.Path]::GetFullPath($Installer)
$outputPath = [System.IO.Path]::GetFullPath($Output)
$runnerTemp = [System.IO.Path]::GetFullPath(($env:RUNNER_TEMP ?? $env:TEMP)).TrimEnd('\')
$root = Join-Path $runnerTemp "skill-studio-pro-ci-smoke-$PID"
$installDirectory = Join-Path $root "installed"
$workspace = Join-Path $root "workspace"
$config = Join-Path $root "config"
$isolatedHome = Join-Path $root "home"
$webview = Join-Path $root "webview"

if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf)) {
    throw "NSIS installer is missing: $installerPath"
}
if (-not $outputPath.StartsWith([System.IO.Path]::GetFullPath((Split-Path -Parent $Output)), [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Invalid output path: $outputPath"
}
New-Item -ItemType Directory -Path $root,$workspace,$config,$isolatedHome,$webview,(Split-Path -Parent $outputPath) -Force | Out-Null

$installerProcess = Start-Process -FilePath $installerPath -ArgumentList @("/S", "/D=$installDirectory") -Wait -PassThru
if ($installerProcess.ExitCode -ne 0) {
    throw "NSIS installation failed with exit code $($installerProcess.ExitCode)"
}
$application = Join-Path $installDirectory "skill-studio-pro.exe"
if (-not (Test-Path -LiteralPath $application -PathType Leaf)) {
    throw "Installed executable is missing: $application"
}

$isolation = [ordered]@{
    HOME = $isolatedHome
    USERPROFILE = $isolatedHome
    APPDATA = (Join-Path $root "appdata\roaming")
    LOCALAPPDATA = (Join-Path $root "appdata\local")
    TEMP = (Join-Path $root "temp")
    TMP = (Join-Path $root "temp")
    XDG_CONFIG_HOME = (Join-Path $root "xdg-config")
    SKILL_STUDIO_PRO_HOME = $isolatedHome
    SKILL_STUDIO_PRO_CONFIG_HOME = $config
    SKILL_STUDIO_PRO_WORKSPACE = $workspace
    WEBVIEW2_USER_DATA_FOLDER = $webview
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--force-renderer-accessibility"
}
foreach ($entry in $isolation.GetEnumerator()) {
    if ($entry.Key -ne "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS") {
        New-Item -ItemType Directory -Path $entry.Value -Force | Out-Null
    }
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process")
}

$appProcess = Start-Process -FilePath $application -PassThru
try {
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    do {
        Start-Sleep -Milliseconds 250
        $appProcess.Refresh()
    } until ($appProcess.HasExited -or $appProcess.MainWindowHandle -ne [IntPtr]::Zero -or [DateTime]::UtcNow -ge $deadline)
    if ($appProcess.HasExited) {
        throw "Installed application exited during startup with code $($appProcess.ExitCode)"
    }
    if ($appProcess.MainWindowHandle -eq [IntPtr]::Zero) {
        throw "Installed application did not expose a desktop window within 30 seconds"
    }
    Start-Sleep -Seconds 5
    $appProcess.Refresh()
    if ($appProcess.HasExited) {
        throw "Installed application did not remain running during smoke observation"
    }
    $workspaceConfig = Join-Path $config "workspace-config.json"
    $database = Join-Path $workspace "metadata.db"
    if (-not (Test-Path -LiteralPath $workspaceConfig -PathType Leaf) -or -not (Test-Path -LiteralPath $database -PathType Leaf)) {
        throw "Application did not bootstrap the isolated config and database"
    }
    $result = [ordered]@{
        status = "PASS"
        platform = "windows"
        installType = "NSIS silent install"
        installerExitCode = $installerProcess.ExitCode
        executableLaunched = $true
        mainWindowObserved = $true
        remainedRunningSeconds = 5
        isolatedBootstrap = $true
        userDataAccessed = $false
        signing = "unsigned"
    }
    [System.IO.File]::WriteAllText($outputPath, ($result | ConvertTo-Json -Depth 5), [System.Text.UTF8Encoding]::new($false))
    $result | ConvertTo-Json -Depth 5
}
finally {
    if (-not $appProcess.HasExited) {
        $actualPath = [System.IO.Path]::GetFullPath($appProcess.Path)
        if (-not $actualPath.StartsWith($root + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to stop a process outside the isolated smoke root: $actualPath"
        }
        Stop-Process -Id $appProcess.Id -Force
        $appProcess.WaitForExit()
    }
}
