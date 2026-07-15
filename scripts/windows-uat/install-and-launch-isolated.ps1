[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Root,

    [Parameter(Mandatory = $true)]
    [string]$Installer,

    [Parameter(Mandatory = $true)]
    [string]$InstallName,

    [Parameter(Mandatory = $true)]
    [string]$ConfigName,

    [Parameter(Mandatory = $true)]
    [string]$WorkspaceName,

    [Parameter(Mandatory = $true)]
    [string]$WebViewName,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath
)

$ErrorActionPreference = "Stop"
$rootPath = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
if (-not ([System.IO.Path]::GetFileName($rootPath).StartsWith("Skill-Studio-Pro-Task2-UAT-", [System.StringComparison]::Ordinal))) {
    throw "Refusing to install outside a dedicated Task 2 UAT root: $rootPath"
}
$installerPath = [System.IO.Path]::GetFullPath($Installer)
if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf)) {
    throw "NSIS installer does not exist: $installerPath"
}

$installRoot = Join-Path $rootPath $InstallName
$installDirectory = Join-Path $installRoot "SkillStudioPro"
if (Test-Path -LiteralPath $installRoot) {
    throw "Install target already exists; use a fresh name: $installRoot"
}
New-Item -ItemType Directory -Path $installRoot | Out-Null

$installerProcess = Start-Process -FilePath $installerPath -ArgumentList @("/S", "/D=$installDirectory") -Wait -PassThru
if ($installerProcess.ExitCode -ne 0) {
    throw "NSIS installer failed with exit code $($installerProcess.ExitCode)"
}
$application = Join-Path $installDirectory "skill-studio-pro.exe"
if (-not (Test-Path -LiteralPath $application -PathType Leaf)) {
    throw "Installed application is missing: $application"
}

$paths = [ordered]@{
    HOME = Join-Path $rootPath "home"
    USERPROFILE = Join-Path $rootPath "home"
    APPDATA = Join-Path $rootPath "appdata\roaming"
    LOCALAPPDATA = Join-Path $rootPath "appdata\local"
    TEMP = Join-Path $rootPath "temp"
    TMP = Join-Path $rootPath "temp"
    XDG_CONFIG_HOME = Join-Path $rootPath "xdg-config"
    CODEX_HOME = Join-Path $rootPath "agents\codex"
    CLAUDE_CONFIG_DIR = Join-Path $rootPath "agents\claude"
    CURSOR_HOME = Join-Path $rootPath "agents\cursor"
    WINDSURF_HOME = Join-Path $rootPath "agents\windsurf"
    GEMINI_CLI_HOME = Join-Path $rootPath "agents\gemini"
    SKILL_STUDIO_PRO_HOME = Join-Path $rootPath "home"
    SKILL_STUDIO_PRO_CONFIG_HOME = Join-Path $rootPath $ConfigName
    SKILL_STUDIO_PRO_WORKSPACE = Join-Path $rootPath $WorkspaceName
    WEBVIEW2_USER_DATA_FOLDER = Join-Path $rootPath $WebViewName
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--force-renderer-accessibility --disable-features=msEdgeSidebarV2"
}
foreach ($entry in $paths.GetEnumerator()) {
    if ($entry.Key -ne "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS") {
        New-Item -ItemType Directory -Path $entry.Value -Force | Out-Null
    }
}
foreach ($entry in $paths.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process")
}

$appProcess = Start-Process -FilePath $application -PassThru
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

$pidPath = Join-Path $rootPath "evidence\desktop.pid"
[System.IO.File]::WriteAllText($pidPath, [string]$appProcess.Id)
$configFile = Join-Path $paths.SKILL_STUDIO_PRO_CONFIG_HOME "workspace-config.json"
$result = [ordered]@{
    installer = $installerPath
    installerExitCode = $installerProcess.ExitCode
    installDirectory = $installDirectory
    application = $application
    pid = $appProcess.Id
    mainWindowHandle = [long]$appProcess.MainWindowHandle
    isolation = $paths
    workspaceConfig = if (Test-Path -LiteralPath $configFile) { Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json } else { $null }
}
$output = [System.IO.Path]::GetFullPath($OutputPath)
if (-not $output.StartsWith($rootPath + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Evidence output must remain inside the UAT root: $output"
}
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $output -Encoding utf8
$result | ConvertTo-Json -Depth 6
