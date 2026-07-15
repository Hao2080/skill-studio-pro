#!/usr/bin/env bash
set -euo pipefail

deb=${1:?usage: smoke-linux.sh <deb> <output-json>}
output=${2:?usage: smoke-linux.sh <deb> <output-json>}
root="${RUNNER_TEMP:-/tmp}/skill-studio-pro-ci-smoke-$$"
workspace="$root/workspace"
config="$root/config"
home="$root/home"
log="$(dirname "$output")/smoke-linux.log"
mkdir -p "$workspace" "$config" "$home" "$(dirname "$output")"

package=$(dpkg-deb -f "$deb" Package)
sudo dpkg -i "$deb"
binary=$(dpkg -L "$package" | grep -E '/bin/skill-studio-pro$' | head -n 1)
test -n "$binary"
test -x "$binary"

export HOME="$home"
export USERPROFILE="$home"
export XDG_CONFIG_HOME="$root/xdg-config"
export SKILL_STUDIO_PRO_HOME="$home"
export SKILL_STUDIO_PRO_CONFIG_HOME="$config"
export SKILL_STUDIO_PRO_WORKSPACE="$workspace"
mkdir -p "$XDG_CONFIG_HOME"

setsid xvfb-run -a "$binary" >"$log" 2>&1 &
pid=$!
cleanup() {
  if kill -0 "$pid" 2>/dev/null; then
    kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT
sleep 10
kill -0 "$pid"
test -f "$config/workspace-config.json"
test -f "$workspace/metadata.db"

node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({status:"PASS",platform:"linux",installType:"deb installed with dpkg",executableLaunched:true,displayHarness:"xvfb-run",remainedRunningSeconds:10,isolatedBootstrap:true,userDataAccessed:false,signing:"unsigned"},null,2)+"\n")' "$output"
cat "$output"
