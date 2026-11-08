# Security policy / Politique de sécurité

AI Filter is a tool that reduces the risk of sending sensitive data to an AI. A flaw in it can therefore have real consequences, and we want to hear about it.
*(Filtre IA réduit le risque d'envoyer des données sensibles à une IA : une faille peut avoir des conséquences réelles, signalez-la.)*

## What to report privately / À signaler en privé

- Any way the page can **send data out** (network request, storage leak, script injection).
- A way to bypass the Content-Security-Policy, or to make the tool run code from a pasted text.
- A flaw in the session encryption (AES-GCM / PBKDF2).
- A bug that **leaks a sensitive value into the cleaned text** *in a systematic way* (not just an unusual format: those go to the public detection issues).

## How to report / Comment signaler

Use GitHub's private reporting: **Security → Report a vulnerability** on the repository
(<https://github.com/ThibaultG10/AI-Filter/security/advisories/new>).

Please do **not** open a public issue for these, and **never include real personal or confidential data** in a report: use fake values.

## What to expect / Ce que vous pouvez attendre

This is a personal open source project maintained by a non-professional developer, in spare time. Reports are read and answered on a best-effort basis, typically within a few days. There is no bug bounty. Credit is given in the fix unless you prefer to stay anonymous.

## Scope and honest limits / Périmètre et limites

- The tool is a **risk reduction aid, not a guarantee**: a value written in an unusual way may not be detected. That is a known limitation, not a vulnerability. Report such cases as a public "missed data" issue, with fake values.
- Supported version: the latest `main`.
- Dependencies are development tools only; `npm audit` must stay at 0 vulnerabilities.
