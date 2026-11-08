# AI Filter user guide

> Risk reduction, not an absolute guarantee: always review the text before sending it.

## Open the tool

Double-click `filtre-ia.html`. It opens in your browser and works offline. Nothing is sent anywhere. Use the **FR / EN** selector at the top right to change the language.

## Use it in 3 steps

**1. Your text.** Paste your prompt and click **Analyze**.

**2. Review.** Detected items (phone numbers, emails, IBANs, IPs, keys, terms from your directory…) are highlighted with their category.
- Wrongly detected? Click it: it is no longer masked (all its occurrences). Click again to mask it.
- Something missed? Select the word in the step 1 text, choose a category, click **Mask selection**. Tick “Add to directory” to keep it for next time.
- Click **Confirm and mask**, review the cleaned text, then **Copy** it and paste it into the AI.

**3. AI reply.** Paste the reply (with its `[CLIENT_1]`, `[EMAIL_2]`… tokens) and click **Restore**. The report shows the tokens restored, the ones the AI invented, and the ones missing from its reply.

> Keep the page open between sending and restoring: tokens only exist in memory. To keep them, use “Session and storage” → “Save encrypted session”.

## Directory

“Forbidden terms directory” section: client names, people, projects, servers… with optional variants. Search ignores case, accents and repeated spaces. Import and export as JSON or CSV (`term;category;alias`, aliases separated by `|`). A sample is provided in `examples/annuaire.csv`.

## Settings

- Turn each detector on or off (for example “SIREN” if it gives too many false positives).
- Enter your internal domains (`corp.local`) to mask internal URLs.

## Privacy

- No network request, no telemetry.
- Directory and settings are stored **in clear text** in this browser. On a shared computer, click **Erase everything** when you are done.
- A saved session is encrypted with your passphrase (8 characters minimum). If you forget it, the session cannot be recovered.

## What the tool does not do

- It does not detect proper names that are not in the directory.
- It does not process images, PDFs or attachments.
- Context can identify a person even when no data is masked. Review the text.
- The AI may reword or omit a token: restoration is not guaranteed at 100%.
