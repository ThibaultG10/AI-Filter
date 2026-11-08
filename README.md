# AI Filter (Filtre IA)

🇬🇧 English version (this file) · 🇫🇷 [Version française](README.fr.md)

A **100% local** anonymizer: it masks sensitive data in a text before you send it to an AI (ChatGPT, Claude, Gemini…), then puts the real values back into the AI's reply.

> Risk reduction, not an absolute guarantee: always review the text before sending it.

Nothing leaves your browser: no server, no network request, no telemetry. The built page enforces this with a strict Content-Security-Policy (`connect-src 'none'`).

## Quick start

**Nothing to install**: open `filtre-ia.html` (single file) in your browser. It works offline with a double-click. See `docs/USER-GUIDE.md`.

**From source** (Node 22.12 or later):

```bash
npm install
npm run dev            # development server
npm run check          # typecheck + tests
npm run build:single   # produces dist-single/filtre-ia.html
npm run e2e            # end-to-end test in Chrome (after build:single)
```

## How it works

1. **Paste** your text and click *Analyze*.
2. **Review**: detected items are highlighted. Click one to stop masking it (false positive); select a word in the text and click *Mask selection* to add something the tool missed.
3. **Confirm and copy** the cleaned text (`Call [PHONE_1] or write to [EMAIL_1]`) into the AI.
4. **Paste the AI's reply** and click *Restore*: the real values come back. The report lists tokens restored, tokens the AI invented, and tokens missing from its reply.

Keep the page open between sending and restoring: tokens live in memory. To keep them, save the session (encrypted with your passphrase).

## What is detected

| Data | Detectors | Validation |
|---|---|---|
| Email | `email` | regex |
| Phone | `phone-fr`, `phone-us` (US/Canada), `phone-uk` (07…, 020…), `phone-intl` (E.164) | 8–15 digits; North American numbering plan for `phone-us` |
| IP | `ipv4`, `ipv6` | octets 0–255 without leading zeros; hexadecimal groups |
| IBAN | `iban` | per-country length + mod 97 |
| Bank card | `card` | network prefix + Luhn |
| Social security (FR) | `nir` | key 97 − (NIR mod 97), Corsica 2A/2B |
| Social security (US) | `ssn` | separators required; area ≠ 000/666/9xx, group ≠ 00, serial ≠ 0000 |
| National Insurance (UK) | `nino` | valid prefix letters, suffix A–D |
| Company IDs (FR) | `siret`, `siren` | Luhn (La Poste exception for SIRET) |
| Keys and secrets | `api-key-sk`, `api-key-aws`, `api-key-github`, `api-key-slack`, `jwt`, `pem` | regex |
| Internal URLs | `internal-url` | configured domains (disabled without a domain) |

On top of that, a **directory** of forbidden terms (client names, people, projects, servers…) with optional aliases. Matching ignores case, accents and repeated whitespace, uses Unicode word boundaries, and the longest term wins. Import and export as JSON or CSV (`term;category;alias`, aliases separated by `|`; sample in `examples/annuaire.csv`).

Engine usage (no DOM):

```ts
import { createDetectors, detect } from './src/core/detectors';

const matches = detect(text, createDetectors({ internalDomains: ['corp.local'] }));
// [{ start, end, value, category }, …] without overlaps
```

## Languages

The interface is available in English and French (FR/EN selector; defaults to the browser language). Tokens follow the language: `[PHONE_1]` in English, `[TEL_1]` in French. Both are restored whichever language is active. Switching language mid-session may create a second token for the same value in a renamed category (e.g. PERSON / PERSONNE); both restore correctly.

## Privacy and storage

- No network request, no telemetry, no backend. A static test (`tests/no-network.test.ts`) fails if the source contains `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `eval`, etc.
- The single-file build only allows the SHA-256 hashes of its own script and style by CSP: no domain, no `unsafe-inline`. The e2e test blocks everything that is not local and fails on any request.
- Settings and directory are stored in **clear text** in the browser (`localStorage`), because the directory is precisely your sensitive terms. Use *Erase everything* on a shared computer.
- Session tokens stay in memory unless you choose *Save encrypted session* (AES-GCM 256, PBKDF2 with 600,000 iterations, passphrase never stored).

## Known limits

- Proper names that are not in the directory are not detected.
- A French social security number without its key (13 digits) is not detected.
- A valid-by-Luhn 9-digit number is masked as a SIREN: false positives are possible; disable the `siren` detector if needed.
- US/UK: SSN only with separators (bare 9 digits are too ambiguous); no EIN, passport or postcode detection yet.
- Context can identify a person without any forbidden term appearing.
- The AI may reword or drop a token: restoration is not guaranteed at 100%.
- Tokens are lost when the page is closed unless the session is saved.
- A value written with different casing (`Dupont`, `DUPONT`) shares one token and is restored with its first spelling.
- Images, PDFs and attachments are not processed.
- Processing is synchronous: very large texts (several MB) are not optimized.

## Project structure

```
src/core     pure engine, no DOM (reusable in a browser extension)
src/ui       interface (model.ts = logic without DOM, app.ts = rendering)
src/config   texts (FR/EN) and defaults
tests        unit and UI tests (Vitest, happy-dom)
scripts      CLI demo, single-file build, e2e
docs         user guides, regex audit
```

Design decisions are recorded in `DECISIONS.md` (in French); the original specification is `CADRAGE.md`.

## Contributing

Contributions are welcome. Run `npm run check` before any proposal, and add at least 10 positive and 10 negative test cases for any new detector (the test suite enforces it). Detectors must follow the regex rules in `docs/REGEX-AUDIT.md`.

## License

MIT, see `LICENSE`.
