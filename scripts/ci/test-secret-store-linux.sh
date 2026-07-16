#!/usr/bin/env bash
set -euo pipefail

root="${RUNNER_TEMP:-/tmp}/skill-studio-pro-secret-store-$$"
mkdir -p "$root/home" "$root/data"
runner_home="$HOME"
export RUSTUP_HOME="${RUSTUP_HOME:-$runner_home/.rustup}"
export CARGO_HOME="${CARGO_HOME:-$runner_home/.cargo}"
export HOME="$root/home"
export XDG_DATA_HOME="$root/data"

dbus-run-session -- bash -euo pipefail -c '
  export HOME="$1"
  export XDG_DATA_HOME="$2"
  eval "$(printf "ci-isolated-keyring-password\n" | gnome-keyring-daemon --unlock --components=secrets)"
  export SKILL_STUDIO_PRO_NATIVE_SECRET_STORE_TEST=1
  cargo test --manifest-path src-tauri/Cargo.toml --test ai_integration native_secret_store_contract -- --exact --nocapture
' bash "$HOME" "$XDG_DATA_HOME"
