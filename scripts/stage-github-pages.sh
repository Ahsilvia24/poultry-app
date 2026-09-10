#!/usr/bin/env bash
# Stage the Expo static web app plus legal pages for GitHub Pages.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
dist="$root/mobile/dist"
site="$root/_site"

if [[ ! -f "$dist/index.html" ]]; then
  echo "Missing $dist/index.html — run: cd mobile && npx expo export --platform web" >&2
  exit 1
fi

rm -rf "$site"
mkdir -p "$site"
cp -R "$dist"/. "$site"/
mkdir -p "$site/privacy" "$site/support"
cp "$root/docs/privacy.html" "$site/privacy/index.html"
cp "$root/docs/support.html" "$site/support/index.html"
# Safari Add to Home Screen looks for these at the site root.
cp "$root/mobile/public/apple-touch-icon.png" "$site/apple-touch-icon.png"
cp "$root/mobile/public/apple-touch-icon-precomposed.png" "$site/apple-touch-icon-precomposed.png"
cp "$root/mobile/public/icon-192.png" "$site/icon-192.png"
cp "$root/mobile/public/icon-512.png" "$site/icon-512.png"
cp "$root/mobile/public/favicon.png" "$site/favicon.png"
cp "$root/mobile/public/manifest.json" "$site/manifest.json"
# Deep links on GitHub Pages fall through to 404.html.
cp "$site/index.html" "$site/404.html"
# Apex custom domain — GitHub Pages reads this from the published site.
printf 'poultrytechapp.com\n' > "$site/CNAME"
echo "Staged GitHub Pages site in $site"
