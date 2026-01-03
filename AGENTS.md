# Repository Guidelines

## Project Structure & Module Organization
- `src/sspu/export-html.js` is the primary browser-console script that exports the schedule HTML.
- `src/original/` stores captured source artifacts for reference and is ignored by Git.
- `inspiration/` contains reference material and is ignored by Git.

## Build, Test, and Development Commands
- No build system is defined; run the script manually in a browser session.
- Example workflow: open the schedule page, press `F12`, paste the contents of `src/sspu/export-html.js` into the Console, and execute it.

## Coding Style & Naming Conventions
- JavaScript is kept ES5-compatible (use `var` and `function`, keep `"use strict"`).
- Indentation is 4 spaces, use double quotes, and include semicolons.
- Naming: `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for constants, keep file names lowercase with hyphens.

## Testing Guidelines
- No automated tests are present.
- If tests are added, place them under `tests/` and document the run command here.

## Commit & Pull Request Guidelines
- Commit history follows `type: summary` (e.g., `refactor: ...`).
- Pull requests should describe behavior changes, include repro steps, and note the browser/version used for validation.

## Security & Configuration Tips
- The script runs in a live browser session; do not paste untrusted code or expose personal data.
- When adjusting export logic, validate against a known sample captured under `src/original/`.
