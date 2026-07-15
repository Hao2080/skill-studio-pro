[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Root
)

$ErrorActionPreference = "Stop"
$requiredLeafPrefix = "Skill-Studio-Pro-Task2-UAT-"
$resolvedRoot = [System.IO.Path]::GetFullPath($Root)

if (-not [System.IO.Path]::IsPathFullyQualified($resolvedRoot)) {
    throw "UAT root must be absolute: $Root"
}

if (-not ([System.IO.Path]::GetFileName($resolvedRoot).StartsWith($requiredLeafPrefix, [System.StringComparison]::Ordinal))) {
    throw "Refusing to write outside a dedicated Task 2 root named $requiredLeafPrefix*: $resolvedRoot"
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
if ($resolvedRoot.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "UAT root must be outside the repository: $resolvedRoot"
}

function Assert-UnderRoot {
    param([Parameter(Mandatory = $true)][string]$Path)

    $resolved = [System.IO.Path]::GetFullPath($Path)
    $prefix = $resolvedRoot.TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to write outside UAT root: $resolved"
    }
    return $resolved
}

function Ensure-Directory {
    param([Parameter(Mandatory = $true)][string]$Path)

    $safePath = Assert-UnderRoot $Path
    [void][System.IO.Directory]::CreateDirectory($safePath)
    return $safePath
}

function Write-Utf8File {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $safePath = Assert-UnderRoot $Path
    [void](Ensure-Directory (Split-Path -Parent $safePath))
    [System.IO.File]::WriteAllText($safePath, $Content, [System.Text.UTF8Encoding]::new($false))
}

$isolatedHome = Ensure-Directory (Join-Path $resolvedRoot "home")
$evidence = Ensure-Directory (Join-Path $resolvedRoot "evidence")
$fixtures = Ensure-Directory (Join-Path $resolvedRoot "fixtures")

$platformRoots = [ordered]@{
    codex = Ensure-Directory (Join-Path $isolatedHome ".codex\skills")
    claude = Ensure-Directory (Join-Path $isolatedHome ".claude\skills")
    cursor = Ensure-Directory (Join-Path $isolatedHome ".cursor\skills")
    windsurf = Ensure-Directory (Join-Path $isolatedHome ".codeium\windsurf\skills")
    gemini = Ensure-Directory (Join-Path $isolatedHome ".gemini\skills")
}

$publishRoots = [ordered]@{
    codex = Ensure-Directory (Join-Path $resolvedRoot "agents\codex\skills")
    claude = Ensure-Directory (Join-Path $resolvedRoot "agents\claude\skills")
    cursor = Ensure-Directory (Join-Path $resolvedRoot "agents\cursor\skills")
    windsurf = Ensure-Directory (Join-Path $resolvedRoot "agents\windsurf\skills")
    gemini = Ensure-Directory (Join-Path $resolvedRoot "agents\gemini\skills")
}

$alpha = Ensure-Directory (Join-Path $platformRoots.codex "alpha-multi")
Write-Utf8File (Join-Path $alpha "SKILL.md") @"
---
name: alpha-multi
description: Windows UAT multi-format skill
metadata:
  short-description: Exercises editor, publish, drift, and trash flows
  tags:
    - uat
    - windows
---
# Alpha Multi

## Usage

Use this fixture only inside the isolated Task 2 root.
"@
Write-Utf8File (Join-Path $alpha "config.yaml") "enabled: true`nitems:`n  - one`n"
Write-Utf8File (Join-Path $alpha "config.json") "{`n  `"enabled`": true,`n  `"count`": 1`n}`n"
Write-Utf8File (Join-Path $alpha "config.toml") "enabled = true`ncount = 1`n"
Write-Utf8File (Join-Path $alpha "notes.txt") "Task 2 isolated plain-text fixture.`n"
$binaryPath = Assert-UnderRoot (Join-Path $alpha "pixel.bin")
[System.IO.File]::WriteAllBytes($binaryPath, [byte[]](0, 255, 16, 128, 1, 2, 3, 4))

$duplicate = Ensure-Directory (Join-Path $platformRoots.claude "alpha-conflict")
Write-Utf8File (Join-Path $duplicate "SKILL.md") @"
---
name: alpha-multi
description: Deliberately different content with the same declared name
---
# Alpha Conflict

This must remain a separate instance and must never be auto-merged.
"@

$invalid = Ensure-Directory (Join-Path $platformRoots.cursor "invalid-yaml")
Write-Utf8File (Join-Path $invalid "SKILL.md") @"
---
name: invalid-yaml
metadata: [unterminated
---
# Invalid YAML

The inventory must retain this instance with a parse error.
"@

$gitKnown = Ensure-Directory (Join-Path $platformRoots.windsurf "git-known")
Write-Utf8File (Join-Path $gitKnown "SKILL.md") @"
---
name: git-known
description: Skill with deterministic Git origin evidence
---
# Git Known

The remote is fictional and must never be contacted.
"@
& git -C $gitKnown init --quiet
& git -C $gitKnown config user.name "Skill Studio Pro UAT"
& git -C $gitKnown config user.email "uat@example.invalid"
& git -C $gitKnown remote add origin "https://example.invalid/skill-studio-pro/fixture.git"
& git -C $gitKnown add SKILL.md
& git -C $gitKnown commit --quiet -m "fixture baseline"

$gemini = Ensure-Directory (Join-Path $platformRoots.gemini "gemini-basic")
Write-Utf8File (Join-Path $gemini "SKILL.md") @"
---
name: gemini-basic
description: Gemini CLI platform-path inference fixture
---
# Gemini Basic
"@

$pluginRoot = Ensure-Directory (Join-Path $isolatedHome ".codex\plugins\cache\acme\1.0.0")
Write-Utf8File (Join-Path $pluginRoot "plugin.json") @"
{
  "name": "acme-isolated-fixture",
  "version": "1.0.0",
  "skills": ["skills/plugin-provenance"]
}
"@
$pluginSkill = Ensure-Directory (Join-Path $pluginRoot "skills\plugin-provenance")
Write-Utf8File (Join-Path $pluginSkill "SKILL.md") @"
---
name: plugin-provenance
description: Plugin manifest provenance fixture
---
# Plugin Provenance
"@

$customRoot = Ensure-Directory (Join-Path $fixtures "custom-scan")
$customSkill = Ensure-Directory (Join-Path $customRoot "custom-plain")
Write-Utf8File (Join-Path $customSkill "SKILL.md") @"
---
name: custom-plain
description: Custom scan root fixture
---
# Custom Plain
"@

$trackedRoots = @($platformRoots.Values) + @($pluginRoot) + @($customRoot)
$manifest = foreach ($trackedRoot in $trackedRoots) {
    Get-ChildItem -LiteralPath $trackedRoot -Recurse -File -Force |
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

$manifestPath = Assert-UnderRoot (Join-Path $evidence "external-files-before-scan.json")
[System.IO.File]::WriteAllText(
    $manifestPath,
    ($manifest | ConvertTo-Json -Depth 5),
    [System.Text.UTF8Encoding]::new($false)
)

$layout = [ordered]@{
    root = $resolvedRoot
    home = $isolatedHome
    configHome = (Assert-UnderRoot (Join-Path $resolvedRoot "config"))
    workspace = (Assert-UnderRoot (Join-Path $resolvedRoot "workspace"))
    appData = (Assert-UnderRoot (Join-Path $resolvedRoot "appdata\roaming"))
    localAppData = (Assert-UnderRoot (Join-Path $resolvedRoot "appdata\local"))
    recycle = (Assert-UnderRoot (Join-Path $resolvedRoot "recycle"))
    logs = (Assert-UnderRoot (Join-Path $resolvedRoot "logs"))
    platformScanRoots = $platformRoots
    publishRoots = $publishRoots
    customScanRoot = $customRoot
    preScanManifest = $manifestPath
}
$layoutPath = Assert-UnderRoot (Join-Path $evidence "uat-layout.json")
[System.IO.File]::WriteAllText(
    $layoutPath,
    ($layout | ConvertTo-Json -Depth 8),
    [System.Text.UTF8Encoding]::new($false)
)

Write-Output "UAT_ROOT=$resolvedRoot"
Write-Output "LAYOUT=$layoutPath"
Write-Output "PRE_SCAN_MANIFEST=$manifestPath"
Write-Output "EXTERNAL_FILE_COUNT=$($manifest.Count)"
