#!/usr/bin/env bash
# Stage the Expo static web app plus legal pages for GitHub Pages.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
dist="$root/mobile/dist"
site="$root/_site"

if [[ ! -f "$dist/index.html" ]]; then
  echo "Missing $dist/index.html — run: cd mobile && EXPO_BASE_URL=/poultry-app npx expo export --platform web" >&2
  exit 1
fi

rm -rf "$site"
mkdir -p "$site"
cp -R "$dist"/. "$site"/
mkdir -p "$site/privacy" "$site/support"
cp "$root/docs/privacy.html" "$site/privacy/index.html"
cp "$root/docs/support.html" "$site/support/index.html"
# Deep links on GitHub Pages fall through to 404.html.
cp "$site/index.html" "$site/404.html"
echo "Staged GitHub Pages site in $site"
