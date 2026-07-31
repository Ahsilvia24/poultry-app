<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Copy-to-clipboard UI

Always use the shared clipboard icon button for copy actions (overlapping-pages glyph → checkmark feedback). Do not use text “Copy” buttons or alternate icons.

- Mobile: `mobile/src/components/ClipboardIconButton.tsx` (Ionicons `copy-outline`)
- Web: `src/components/ClipboardIconButton.tsx`
