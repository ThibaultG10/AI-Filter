# Contributing / Contribuer

Thanks for helping. This project is maintained by a non-professional developer, so reviews, test cases and critical remarks are as valuable as code.
*(Merci ! Les relectures, les cas de test et les critiques valent autant que le code.)*

## ⚠️ Never post real data / Ne postez jamais de vraies données

In issues, pull requests and comments, **use fake values only** (`06 12 34 56 78`, `jean@example.com`, `FR76 3000 6000 0112 3456 7890 189`). A report containing a real IBAN, key or phone number is a leak, even on a public repository.

## Ways to help / Comment aider

- **Report a missed or wrongly masked value** using the issue templates (with a fake example).
- **Add a detector** for a format that matters to you (see below).
- **Review the code**, especially `src/core` and the security claims in `docs/REGEX-AUDIT.md`.
- **Improve the translations** in `src/config/texts.ts`.

## Setup

Node 22.12 or later.

```bash
git clone https://github.com/ThibaultG10/AI-Filter.git
cd AI-Filter
npm install
npm run dev      # development server
npm run check    # typecheck + all tests (must pass)
```

## Adding a detector

1. Add it in `src/core/detectors.ts`, with a validation function in `src/core/validators.ts` when the format has a checksum or structural rules (it removes most false positives).
2. Follow the regex rules in `docs/REGEX-AUDIT.md`: no nested ambiguous quantifiers, bounded repetitions, a lookbehind at the start, no shared state.
3. Add **at least 10 positive and 10 negative cases** in `tests/detectors.test.ts` (the suite enforces it), adversarial inputs in `tests/robustness.test.ts`, and a label in both languages in `src/config/texts.ts`.
4. Mention what is *not* covered in the README "Known limits".

A detector that produces many false positives on ordinary text will be refused or disabled by default: a tool people stop trusting is worse than a smaller tool.

## Pull requests

- Keep them small and focused; explain the *why*.
- `npm run check` must pass. If you touch the UI, also run `npm run build:single && npm run e2e` (needs Chrome).
- The built page must stay **100% local**: no network call, no telemetry, no external script or font. Tests enforce this and it is not negotiable.
- By contributing, you agree that your contribution is released under the MIT license.
