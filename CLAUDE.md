# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a plain HTML app — **Newriver United Soccer Session Planner** — with no build system, package manager, or test suite. Open [index.html](index.html) directly in a browser to run it.

## Architecture

The app has three files:

1. **[styles.css](styles.css)** — custom design system using CSS variables (`--black`, `--green`, `--bg`, etc.) with mobile-first layout and print styles.
2. **[index.html](index.html)** — five mutually exclusive views toggled by JS: `view-form`, `view-loading`, `view-result`, `view-saved`, `view-apikey`.
3. **[script.js](script.js)** — vanilla JS with no dependencies. Key globals:
   - `currentPlan` / `currentPreForm` — hold the last generated session data
   - `localStorage` — persists the Anthropic API key (`newriver_api_key`) and saved sessions (`newriver_sessions_v2`, max 20 entries)

## Claude API Integration

The app calls the Anthropic Messages API directly from the browser using the user's own API key. The model is hardcoded as `claude-sonnet-4-20250514` with `max_tokens: 1000`. The prompt requests a strict JSON response with two top-level keys: `sessionPlan` and `preSessionForm`. The `anthropic-dangerous-direct-browser-access: true` header is required for browser-based calls.

## View Flow

```
onload → check API key in localStorage
  → if missing: show apikey view
  → else: show form view
       ↓
generate() → show loading view → fetch Anthropic API
  → on success: renderPlan() + renderPreForm() → show result view (two tabs)
  → on error: show form view with error banner
```

## Key Conventions

- **XSS protection**: All user/API data rendered into HTML goes through `esc()` (HTML entity escaping). Do not render untrusted content without it.
- **Pill selection**: Focus and difficulty pills use `data-group` attributes; `selectPill()` manages single-selection per group.
- **Section types** map to border colors: `warm`, `tech`, `game`, `scrim`, `cool` → `BORDER_COLORS`.
- **Focus types** map to badge/pill CSS classes via `FOCUS_CLASSES` and `BADGE_CLASSES`.
- The form section in the HTML uses a fenced code block (` ``` `) as a delimiter artifact — this is in the HTML source and renders as-is; it's not intentional markdown.
