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

set +e
NO_AT_BRIDGE=1 timeout --kill-after=5s 10s dbus-run-session -- xvfb-run -a "$binary" >"$log" 2>&1
launch_status=$?
set -e
if [[ "$launch_status" -ne 124 ]]; then
  echo "Installed application exited before the 10-second observation window (status $launch_status)" >&2
  cat "$log" >&2
  exit 1
fi
if [[ ! -f "$config/workspace-config.json" || ! -f "$workspace/metadata.db" ]]; then
  echo "Installed application did not bootstrap the isolated config and database" >&2
  find "$root" -maxdepth 3 -type f -print >&2
  cat "$log" >&2
  exit 1
fi

node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({status:"PASS",platform:"linux",installType:"deb installed with dpkg",executableLaunched:true,displayHarness:"dbus-run-session + xvfb-run",observationTimeoutExitCode:124,remainedRunningSeconds:10,isolatedBootstrap:true,userDataAccessed:false,signing:"unsigned"},null,2)+"\n")' "$output"
cat "$output"
