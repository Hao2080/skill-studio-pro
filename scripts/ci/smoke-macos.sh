#!/usr/bin/env bash
set -euo pipefail

dmg=${1:?usage: smoke-macos.sh <dmg> <output-json>}
output=${2:?usage: smoke-macos.sh <dmg> <output-json>}
root="${RUNNER_TEMP:-/tmp}/skill-studio-pro-ci-smoke-$$"
mount="$root/mount"
install="$root/installed"
workspace="$root/workspace"
config="$root/config"
home="$root/home"
log="$(dirname "$output")/smoke-macos.log"
mkdir -p "$mount" "$install" "$workspace" "$config" "$home" "$(dirname "$output")"

hdiutil attach "$dmg" -nobrowse -readonly -mountpoint "$mount" >/dev/null
app=$(find "$mount" -maxdepth 1 -type d -name '*.app' -print -quit)
if [[ -z "$app" ]]; then
  hdiutil detach "$mount" >/dev/null
  echo "No .app was found in $dmg" >&2
  exit 1
fi
ditto "$app" "$install/Skill Studio Pro.app"
hdiutil detach "$mount" >/dev/null
binary="$install/Skill Studio Pro.app/Contents/MacOS/skill-studio-pro"
test -x "$binary"

export HOME="$home"
export USERPROFILE="$home"
export XDG_CONFIG_HOME="$root/xdg-config"
export SKILL_STUDIO_PRO_HOME="$home"
export SKILL_STUDIO_PRO_CONFIG_HOME="$config"
export SKILL_STUDIO_PRO_WORKSPACE="$workspace"
mkdir -p "$XDG_CONFIG_HOME"

"$binary" >"$log" 2>&1 &
pid=$!
cleanup() {
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT
sleep 10
kill -0 "$pid"
test -f "$config/workspace-config.json"
test -f "$workspace/metadata.db"

cleanup
trap - EXIT
printf '%s\n' 'PASS: DMG mounted, app copied, executable remained running for 10 seconds, and isolated bootstrap completed.' >>"$log"

node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({status:"PASS",platform:"macos",installType:"DMG mounted and app copied",executableLaunched:true,remainedRunningSeconds:10,isolatedBootstrap:true,userDataAccessed:false,signing:"not Developer ID signed or notarized"},null,2)+"\n")' "$output"
cat "$output"
