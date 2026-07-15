[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Root,

    [Parameter(Mandatory = $true)]
    [ValidateSet("tree", "invoke", "click", "set-value", "toggle", "focus", "send-keys", "resize", "screenshot", "screenshot-element", "wait")]
    [string]$Action,

    [string]$Name = "",

    [ValidateSet("exact", "contains", "regex")]
    [string]$NameMode = "exact",

    [string]$ControlType = "",

    [int]$Occurrence = 0,

    [string]$Value = "",

    [string]$OutputPath = "",

    [int]$Width = 0,

    [int]$Height = 0,

    [double]$DpiScale = 1.0,

    [int]$TimeoutSeconds = 10,

    [switch]$WaitForMissing
)

$ErrorActionPreference = "Stop"
$requiredLeafPrefix = "Skill-Studio-Pro-Task2-UAT-"
$resolvedRoot = [System.IO.Path]::GetFullPath($Root)
if (-not ([System.IO.Path]::GetFileName($resolvedRoot).StartsWith($requiredLeafPrefix, [System.StringComparison]::Ordinal))) {
    throw "Refusing to drive a process outside a dedicated Task 2 root: $resolvedRoot"
}

$pidFile = Join-Path $resolvedRoot "evidence\desktop.pid"
if (-not (Test-Path -LiteralPath $pidFile)) {
    throw "Desktop PID file is missing: $pidFile"
}

$processId = [int]([System.IO.File]::ReadAllText($pidFile).Trim())
$process = Get-Process -Id $processId -ErrorAction Stop
$processPath = [System.IO.Path]::GetFullPath($process.Path)
$rootPrefix = $resolvedRoot.TrimEnd('\') + '\'
if (-not $processPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "PID $processId is not the isolated installed app: $processPath"
}

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

if (-not ("UatNativeMethods" -as [type])) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class UatNativeMethods
{
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetWindowPos(
        IntPtr hWnd,
        IntPtr hWndInsertAfter,
        int X,
        int Y,
        int cx,
        int cy,
        uint uFlags);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
}
"@
}

$window = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
if ($null -eq $window) {
    throw "UI Automation could not obtain the Skill Studio Pro window for PID $processId"
}

function Get-Elements {
    $all = $window.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.Condition]::TrueCondition
    )
    for ($index = 0; $index -lt $all.Count; $index += 1) {
        $all.Item($index)
    }
}

function Test-ElementName {
    param([System.Windows.Automation.AutomationElement]$Element)

    $elementName = [string]$Element.Current.Name
    switch ($NameMode) {
        "exact" { return $elementName -eq $Name }
        "contains" { return $elementName.Contains($Name, [System.StringComparison]::OrdinalIgnoreCase) }
        "regex" { return $elementName -match $Name }
    }
}

function Find-Elements {
    $matches = @(Get-Elements | Where-Object {
        (Test-ElementName $_) -and
        (-not $ControlType -or $_.Current.ControlType.ProgrammaticName -eq "ControlType.$ControlType")
    })
    return $matches
}

function Find-Element {
    $matches = @(Find-Elements)
    if ($Occurrence -lt 0 -or $Occurrence -ge $matches.Count) {
        $available = $matches | ForEach-Object { "[$($_.Current.ControlType.ProgrammaticName)] $($_.Current.Name)" }
        throw "Element occurrence $Occurrence was not found for name '$Name' type '$ControlType'. Matches: $($available -join '; ')"
    }
    return $matches[$Occurrence]
}

function Convert-Element {
    param(
        [System.Windows.Automation.AutomationElement]$Element,
        [int]$Index
    )

    $bounds = $Element.Current.BoundingRectangle
    return [ordered]@{
        index = $Index
        name = $Element.Current.Name
        automationId = $Element.Current.AutomationId
        controlType = $Element.Current.ControlType.ProgrammaticName
        className = $Element.Current.ClassName
        enabled = $Element.Current.IsEnabled
        offscreen = $Element.Current.IsOffscreen
        focusable = $Element.Current.IsKeyboardFocusable
        hasFocus = $Element.Current.HasKeyboardFocus
        bounds = [ordered]@{
            x = [math]::Round($bounds.X, 2)
            y = [math]::Round($bounds.Y, 2)
            width = [math]::Round($bounds.Width, 2)
            height = [math]::Round($bounds.Height, 2)
        }
    }
}

function Invoke-Element {
    param([System.Windows.Automation.AutomationElement]$Element)

    $pattern = $null
    if ($Element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {
        ([System.Windows.Automation.InvokePattern]$pattern).Invoke()
        return "invoke-pattern"
    }

    $bounds = $Element.Current.BoundingRectangle
    if ($bounds.Width -le 0 -or $bounds.Height -le 0) {
        throw "Element has no clickable bounds: $($Element.Current.Name)"
    }
    [void][UatNativeMethods]::SetForegroundWindow($process.MainWindowHandle)
    [void][UatNativeMethods]::SetCursorPos(
        [int]($bounds.X + ($bounds.Width / 2)),
        [int]($bounds.Y + ($bounds.Height / 2))
    )
    [UatNativeMethods]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
    [UatNativeMethods]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
    return "mouse-fallback"
}

switch ($Action) {
    "tree" {
        $elements = @(Get-Elements)
        $result = for ($index = 0; $index -lt $elements.Count; $index += 1) {
            Convert-Element $elements[$index] $index
        }
        $json = $result | ConvertTo-Json -Depth 6
        if ($OutputPath) {
            $fullOutput = [System.IO.Path]::GetFullPath($OutputPath)
            if (-not $fullOutput.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "Tree output must stay inside the UAT root: $fullOutput"
            }
            [System.IO.File]::WriteAllText($fullOutput, $json, [System.Text.UTF8Encoding]::new($false))
        }
        Write-Output $json
    }
    "invoke" {
        $element = Find-Element
        $elementEvidence = Convert-Element $element $Occurrence
        $method = Invoke-Element $element
        [ordered]@{ action = $Action; method = $method; element = $elementEvidence } | ConvertTo-Json -Depth 6
    }
    "click" {
        $element = Find-Element
        $bounds = $element.Current.BoundingRectangle
        [void][UatNativeMethods]::SetForegroundWindow($process.MainWindowHandle)
        [void][UatNativeMethods]::SetCursorPos(
            [int]($bounds.X + ($bounds.Width / 2)),
            [int]($bounds.Y + ($bounds.Height / 2))
        )
        [UatNativeMethods]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
        [UatNativeMethods]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
        [ordered]@{ action = $Action; element = Convert-Element $element $Occurrence } | ConvertTo-Json -Depth 6
    }
    "set-value" {
        $element = Find-Element
        $pattern = $null
        if (-not $element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) {
            throw "Element does not support ValuePattern: $($element.Current.Name)"
        }
        ([System.Windows.Automation.ValuePattern]$pattern).SetValue($Value)
        [ordered]@{ action = $Action; name = $element.Current.Name; valueLength = $Value.Length } | ConvertTo-Json
    }
    "toggle" {
        $element = Find-Element
        $pattern = $null
        if (-not $element.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$pattern)) {
            throw "Element does not support TogglePattern: $($element.Current.Name)"
        }
        $toggle = [System.Windows.Automation.TogglePattern]$pattern
        $before = $toggle.Current.ToggleState.ToString()
        $toggle.Toggle()
        $after = $toggle.Current.ToggleState.ToString()
        [ordered]@{ action = $Action; name = $element.Current.Name; before = $before; after = $after } | ConvertTo-Json
    }
    "focus" {
        $element = Find-Element
        [void][UatNativeMethods]::SetForegroundWindow($process.MainWindowHandle)
        $element.SetFocus()
        [ordered]@{ action = $Action; element = Convert-Element $element $Occurrence } | ConvertTo-Json -Depth 6
    }
    "send-keys" {
        Add-Type -AssemblyName System.Windows.Forms
        $element = Find-Element
        [void][UatNativeMethods]::SetForegroundWindow($process.MainWindowHandle)
        $element.SetFocus()
        [System.Windows.Forms.SendKeys]::SendWait($Value)
        [ordered]@{ action = $Action; name = $element.Current.Name; keys = $Value } | ConvertTo-Json
    }
    "resize" {
        if ($Width -lt 1 -or $Height -lt 1 -or $DpiScale -le 0) {
            throw "resize requires positive Width, Height, and DpiScale"
        }
        $bounds = $window.Current.BoundingRectangle
        $physicalWidth = [int][math]::Round($Width * $DpiScale)
        $physicalHeight = [int][math]::Round($Height * $DpiScale)
        $flags = 0x0010 -bor 0x0004
        if (-not [UatNativeMethods]::SetWindowPos(
            $process.MainWindowHandle,
            [IntPtr]::Zero,
            [int]$bounds.X,
            [int]$bounds.Y,
            $physicalWidth,
            $physicalHeight,
            $flags
        )) {
            throw "SetWindowPos failed for ${Width}x${Height} at scale $DpiScale"
        }
        Start-Sleep -Milliseconds 750
        [ordered]@{ action = $Action; logicalWidth = $Width; logicalHeight = $Height; dpiScale = $DpiScale; physicalWidth = $physicalWidth; physicalHeight = $physicalHeight } | ConvertTo-Json
    }
    "screenshot" {
        if (-not $OutputPath) {
            throw "screenshot requires OutputPath"
        }
        $fullOutput = [System.IO.Path]::GetFullPath($OutputPath)
        if (-not $fullOutput.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Screenshot output must stay inside the UAT root: $fullOutput"
        }
        Add-Type -AssemblyName System.Drawing
        $bounds = $window.Current.BoundingRectangle
        $bitmap = [System.Drawing.Bitmap]::new([int]$bounds.Width, [int]$bounds.Height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.CopyFromScreen([int]$bounds.X, [int]$bounds.Y, 0, 0, $bitmap.Size)
            $bitmap.Save($fullOutput, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $graphics.Dispose()
            $bitmap.Dispose()
        }
        [ordered]@{ action = $Action; path = $fullOutput; width = [int]$bounds.Width; height = [int]$bounds.Height } | ConvertTo-Json
    }
    "screenshot-element" {
        if (-not $OutputPath) {
            throw "screenshot-element requires OutputPath"
        }
        $fullOutput = [System.IO.Path]::GetFullPath($OutputPath)
        if (-not $fullOutput.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Screenshot output must stay inside the UAT root: $fullOutput"
        }
        Add-Type -AssemblyName System.Drawing
        $element = Find-Element
        $bounds = $element.Current.BoundingRectangle
        if ($bounds.Width -le 0 -or $bounds.Height -le 0) {
            throw "Element has no screenshot bounds: $($element.Current.Name)"
        }
        $bitmap = [System.Drawing.Bitmap]::new([int]$bounds.Width, [int]$bounds.Height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.CopyFromScreen([int]$bounds.Left, [int]$bounds.Top, 0, 0, $bitmap.Size)
            $bitmap.Save($fullOutput, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $graphics.Dispose()
            $bitmap.Dispose()
        }
        [ordered]@{ action = $Action; path = $fullOutput; element = Convert-Element $element $Occurrence } | ConvertTo-Json -Depth 6
    }
    "wait" {
        $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
        do {
            $matches = @(Find-Elements)
            $satisfied = if ($WaitForMissing) { $matches.Count -eq 0 } else { $matches.Count -gt $Occurrence }
            if ($satisfied) {
                [ordered]@{ action = $Action; found = -not $WaitForMissing; count = $matches.Count; elapsedBeforeTimeout = $true } | ConvertTo-Json
                exit 0
            }
            Start-Sleep -Milliseconds 250
        } while ([DateTime]::UtcNow -lt $deadline)
        throw "Timed out after $TimeoutSeconds seconds waiting for name '$Name' (missing=$WaitForMissing)"
    }
}
