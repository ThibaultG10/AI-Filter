import { DEFAULT_CATEGORIES } from '../core/directory';
import { createDetectors } from '../core/detectors';
import { decryptSession, encryptSession, MIN_PASSPHRASE_LENGTH } from '../core/session-crypto';
import { TokenSession } from '../core/pseudonymize';
import { BANNER_TEXT, TEXTS as T } from '../config/texts';
import { clear, copyText, downloadText, h } from './dom';
import { AppModel, type ReviewItem } from './model';
import { Storage } from './storage';

const MAX_LISTED_ENTRIES = 200;
const MAX_LISTED_ERRORS = 10;

export interface MountOptions {
  storage?: Storage;
  /** Itérations PBKDF2 (réduit en test). */
  iterations?: number;
}

export function mount(root: HTMLElement, options: MountOptions = {}): AppModel {
  const storage = options.storage ?? new Storage();
  const model = new AppModel(storage.loadSettings(), storage.loadDirectory());

  // --- Éléments --------------------------------------------------------------
  const input = h('textarea', { id: 'input', rows: '8', spellcheck: 'false', autocomplete: 'off' });
  const inputStatus = h('p', { id: 'input-status', class: 'status', role: 'status' });
  const analyzeBtn = h('button', { id: 'analyze', type: 'button', class: 'primary', text: T.analyze });
  const categoryInput = h('input', { id: 'mask-category', list: 'categories', value: 'INTERNE', 'aria-label': T.categoryLabel });
  const categoryList = h('datalist', { id: 'categories' }, ...DEFAULT_CATEGORIES.map((c) => h('option', { value: c })));
  const permanent = h('input', { id: 'mask-permanent', type: 'checkbox' });
  const maskBtn = h('button', { id: 'mask-selection', type: 'button', text: T.maskSelection });

  const reviewSection = h('section', { id: 'review', 'aria-labelledby': 'h-review', hidden: true });
  const counter = h('p', { id: 'counter', class: 'counter', 'aria-live': 'polite' });
  const preview = h('div', { id: 'preview', class: 'preview', role: 'group', 'aria-label': T.previewLabel });
  const validateBtn = h('button', { id: 'validate', type: 'button', class: 'primary', text: T.validate });
  const cleaned = h('textarea', { id: 'cleaned', rows: '6', readonly: true });
  const copyCleanedBtn = h('button', { id: 'copy-cleaned', type: 'button', text: T.copy, disabled: true });
  const cleanedStatus = h('p', { id: 'cleaned-status', class: 'status', role: 'status' });

  const reply = h('textarea', { id: 'reply', rows: '6', spellcheck: 'false' });
  const restoreBtn = h('button', { id: 'restore', type: 'button', class: 'primary', text: T.restore });
  const restored = h('textarea', { id: 'restored', rows: '6', readonly: true });
  const copyRestoredBtn = h('button', { id: 'copy-restored', type: 'button', text: T.copy, disabled: true });
  const report = h('div', { id: 'report', class: 'status', role: 'status' });

  // --- Étape 1 : analyse -----------------------------------------------------
  function setStatus(el: HTMLElement, message: string, isError = false): void {
    el.textContent = message;
    el.classList.toggle('error', isError);
  }

  function runAnalysis(): void {
    if (input.value.trim() === '') {
      setStatus(inputStatus, T.emptyInput, true);
      return;
    }
    setStatus(inputStatus, '');
    model.analyze(input.value);
    cleaned.value = '';
    copyCleanedBtn.disabled = true;
    setStatus(cleanedStatus, '');
    reviewSection.hidden = false;
    renderReview();
  }

  function renderReview(focusIndex?: number): void {
    const items = model.review();
    const text = model.analyzedText ?? '';
    clear(preview);
    let cursor = 0;
    items.forEach((item, index) => {
      if (item.match.start > cursor) preview.append(text.slice(cursor, item.match.start));
      preview.append(markButton(item, index));
      cursor = item.match.end;
    });
    if (cursor < text.length) preview.append(text.slice(cursor));
    const n = items.filter((i) => i.masked).length;
    counter.textContent = T.counter(n, items.length - n);
    validateBtn.disabled = input.value !== model.analyzedText;
    if (focusIndex !== undefined) preview.querySelectorAll<HTMLElement>('button.mark')[focusIndex]?.focus();
  }

  function markButton(item: ReviewItem, index: number): HTMLElement {
    const { match } = item;
    const label = item.masked ? T.markMasked(match.value, match.category) : T.markUnmasked(match.value, match.category);
    const btn = h(
      'button',
      {
        type: 'button',
        class: item.masked ? 'mark masked' : 'mark unmasked',
        'aria-pressed': String(item.masked),
        'aria-label': label,
        title: label,
      },
      match.value,
      h('span', { class: 'cat', 'aria-hidden': 'true', text: match.category }),
    );
    btn.addEventListener('click', () => {
      model.toggleValue(item.key);
      cleaned.value = '';
      copyCleanedBtn.disabled = true;
      setStatus(cleanedStatus, '');
      renderReview(index);
    });
    return btn;
  }

  analyzeBtn.addEventListener('click', runAnalysis);
  input.addEventListener('input', () => {
    if (model.analyzedText !== null) {
      validateBtn.disabled = input.value !== model.analyzedText;
      if (validateBtn.disabled) setStatus(inputStatus, T.staleAnalysis);
      else setStatus(inputStatus, '');
    }
  });

  maskBtn.addEventListener('click', () => {
    const selected = input.value.slice(input.selectionStart, input.selectionEnd).trim();
    if (selected === '') {
      setStatus(inputStatus, T.noSelection, true);
      return;
    }
    const result = model.addTerm(selected, categoryInput.value || 'INTERNE', permanent.checked);
    if (!result.ok) {
      setStatus(inputStatus, result.error, true);
      return;
    }
    if (permanent.checked) storage.saveDirectory(model.directory);
    renderDirectory();
    runAnalysis();
    setStatus(inputStatus, T.maskedOk(selected));
  });

  // --- Validation ------------------------------------------------------------
  validateBtn.addEventListener('click', () => {
    const result = model.validate();
    if (!result) return;
    cleaned.value = result.text;
    copyCleanedBtn.disabled = false;
    setStatus(cleanedStatus, T.validated(result.replacements.length));
    refreshSessionInfo();
  });
  copyCleanedBtn.addEventListener('click', async () => {
    setStatus(cleanedStatus, (await copyText(cleaned.value, cleaned)) ? T.copied : T.copyFailed);
  });

  // --- Restauration ----------------------------------------------------------
  restoreBtn.addEventListener('click', () => {
    if (model.session.size === 0) {
      setStatus(report, T.noSessionTokens, true);
      return;
    }
    const r = model.restore(reply.value);
    restored.value = r.text;
    copyRestoredBtn.disabled = false;
    clear(report);
    report.classList.remove('error');
    report.append(h('p', { text: T.restoredCount(r.restored) }));
    if (r.unknown.length > 0) report.append(h('p', { class: 'warn', text: T.unknownTokens(r.unknown) }));
    if (r.missing.length > 0) report.append(h('p', { text: T.missingTokens(r.missing) }));
  });
  copyRestoredBtn.addEventListener('click', async () => {
    const ok = await copyText(restored.value, restored);
    report.append(h('p', { text: ok ? T.copied : T.copyFailed }));
  });

  // --- Réglages --------------------------------------------------------------
  const detectorList = h('ul', { class: 'plain' });
  const domainsInput = h('textarea', { id: 'domains', rows: '3', spellcheck: 'false', placeholder: 'entreprise.local' });
  domainsInput.value = model.settings.internalDomains.join('\n');

  function renderDetectors(): void {
    clear(detectorList);
    for (const d of createDetectors({ enabled: model.settings.enabled, internalDomains: model.settings.internalDomains })) {
      const box = h('input', { type: 'checkbox', id: `det-${d.id}` });
      box.checked = d.enabled;
      box.addEventListener('change', () => {
        model.settings.enabled[d.id] = box.checked;
        storage.saveSettings(model.settings);
      });
      detectorList.append(h('li', {}, box, h('label', { for: `det-${d.id}`, text: ` ${d.label}` })));
    }
  }
  domainsInput.addEventListener('change', () => {
    model.settings.internalDomains = domainsInput.value
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200);
    delete model.settings.enabled['internal-url'];
    storage.saveSettings(model.settings);
    renderDetectors();
  });

  // --- Annuaire --------------------------------------------------------------
  const dirTerm = h('input', { id: 'dir-term', autocomplete: 'off' });
  const dirCategory = h('input', { id: 'dir-category', list: 'categories', value: 'CLIENT' });
  const dirAliases = h('input', { id: 'dir-aliases', autocomplete: 'off', placeholder: 'variante 1 | variante 2' });
  const dirStatus = h('p', { id: 'dir-status', class: 'status', role: 'status' });
  const dirList = h('ul', { id: 'dir-list', class: 'plain dir' });
  const dirAdd = h('button', { id: 'dir-add', type: 'button', text: T.add });
  const importFile = h('input', { id: 'dir-import', type: 'file', accept: '.json,.csv,.txt' });

  function renderDirectory(): void {
    clear(dirList);
    model.directory.slice(0, MAX_LISTED_ENTRIES).forEach((entry, index) => {
      const remove = h('button', { type: 'button', class: 'small', 'aria-label': T.removeEntry(entry.term), text: T.remove });
      remove.addEventListener('click', () => {
        model.removeEntry(index);
        storage.saveDirectory(model.directory);
        renderDirectory();
      });
      const aliases = entry.aliases.length > 0 ? ` (${entry.aliases.join(' | ')})` : '';
      dirList.append(h('li', {}, h('span', { text: `${entry.term}${aliases} · ` }), h('span', { class: 'cat-tag', text: entry.category }), remove));
    });
    const extra = model.directory.length - MAX_LISTED_ENTRIES;
    if (extra > 0) dirList.append(h('li', { text: T.moreEntries(extra) }));
    dirStatus.dataset['count'] = String(model.directory.length);
  }

  dirAdd.addEventListener('click', () => {
    const aliases = dirAliases.value.split('|').map((a) => a.trim()).filter(Boolean);
    const result = model.addTerm(dirTerm.value, dirCategory.value, true, aliases);
    if (!result.ok) {
      setStatus(dirStatus, result.error, true);
      return;
    }
    storage.saveDirectory(model.directory);
    dirTerm.value = '';
    dirAliases.value = '';
    setStatus(dirStatus, T.entryAdded);
    renderDirectory();
  });

  importFile.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    const text = await file.text();
    const r = model.importDirectory(text, file.name);
    storage.saveDirectory(model.directory);
    renderDirectory();
    clear(dirStatus);
    dirStatus.classList.remove('error');
    dirStatus.append(h('p', { text: T.importSummary(r.added, r.skipped, r.errors.length) }));
    for (const e of r.errors.slice(0, MAX_LISTED_ERRORS)) {
      dirStatus.append(h('p', { class: 'warn', text: e.line > 0 ? `Ligne ${e.line} : ${e.message}` : e.message }));
    }
    importFile.value = '';
  });
  const exportJsonBtn = h('button', { id: 'dir-export-json', type: 'button', text: T.exportJson });
  const exportCsvBtn = h('button', { id: 'dir-export-csv', type: 'button', text: T.exportCsv });
  exportJsonBtn.addEventListener('click', () => downloadText('annuaire.json', model.exportDirectory('json'), 'application/json'));
  exportCsvBtn.addEventListener('click', () => downloadText('annuaire.csv', model.exportDirectory('csv'), 'text/csv'));

  // --- Session ---------------------------------------------------------------
  const passphrase = h('input', { id: 'passphrase', type: 'password', autocomplete: 'new-password' });
  const sessionInfo = h('p', { id: 'session-info' });
  const sessionStatus = h('p', { id: 'session-status', class: 'status', role: 'status' });
  const saveSessionBtn = h('button', { id: 'session-save', type: 'button', text: T.sessionSave });
  const loadSessionBtn = h('button', { id: 'session-load', type: 'button', text: T.sessionLoad });
  const deleteSessionBtn = h('button', { id: 'session-delete', type: 'button', text: T.sessionDelete });
  const newSessionBtn = h('button', { id: 'session-new', type: 'button', text: T.sessionNew });
  const wipeBtn = h('button', { id: 'wipe', type: 'button', class: 'danger', text: T.wipe });

  function refreshSessionInfo(): void {
    sessionInfo.textContent = T.sessionCount(model.session.size);
  }

  saveSessionBtn.addEventListener('click', async () => {
    if (passphrase.value.length < MIN_PASSPHRASE_LENGTH) {
      setStatus(sessionStatus, T.passphraseTooShort(MIN_PASSPHRASE_LENGTH), true);
      return;
    }
    const enc = await encryptSession(model.session.toData(), passphrase.value, options.iterations);
    if (!enc.ok) return setStatus(sessionStatus, enc.error, true);
    setStatus(sessionStatus, storage.saveEncryptedSession(enc.payload) ? T.sessionSaved : T.storageUnavailable, false);
  });
  loadSessionBtn.addEventListener('click', async () => {
    const payload = storage.loadEncryptedSession();
    if (!payload) return setStatus(sessionStatus, T.noSavedSession, true);
    const dec = await decryptSession(payload, passphrase.value);
    if (!dec.ok) return setStatus(sessionStatus, dec.error, true);
    const loaded = TokenSession.fromData(dec.data);
    if (!loaded.ok) return setStatus(sessionStatus, loaded.error, true);
    model.session = loaded.session;
    refreshSessionInfo();
    setStatus(sessionStatus, T.sessionLoaded);
  });
  deleteSessionBtn.addEventListener('click', () => {
    storage.clearEncryptedSession();
    setStatus(sessionStatus, T.sessionDeleted);
  });
  newSessionBtn.addEventListener('click', () => {
    model.newSession();
    cleaned.value = '';
    copyCleanedBtn.disabled = true;
    refreshSessionInfo();
    setStatus(sessionStatus, T.sessionCleared);
  });
  wipeBtn.addEventListener('click', () => {
    storage.clearAll();
    model.newSession();
    model.directory = [];
    model.temporary = [];
    model.settings = { enabled: {}, internalDomains: [] };
    domainsInput.value = '';
    renderDetectors();
    renderDirectory();
    refreshSessionInfo();
    setStatus(sessionStatus, T.wiped);
  });

  // --- Assemblage ------------------------------------------------------------
  const field = (id: string, label: string, control: HTMLElement) =>
    h('div', { class: 'field' }, h('label', { for: id, text: label }), control);

  reviewSection.append(
    h('h2', { id: 'h-review', text: T.step2 }),
    counter,
    preview,
    h('p', { class: 'hint', text: T.reviewHint }),
    h('div', { class: 'row' }, validateBtn),
    field('cleaned', T.cleanedLabel, cleaned),
    h('div', { class: 'row' }, copyCleanedBtn),
    cleanedStatus,
  );

  root.append(
    h('header', {}, h('h1', { text: T.title }), h('p', { class: 'banner', role: 'note', text: BANNER_TEXT })),
    h(
      'main',
      {},
      h(
        'section',
        { 'aria-labelledby': 'h-input' },
        h('h2', { id: 'h-input', text: T.step1 }),
        field('input', T.inputLabel, input),
        h('div', { class: 'row' }, analyzeBtn),
        h(
          'div',
          { class: 'row manual' },
          h('label', { for: 'mask-category', text: T.categoryLabel }),
          categoryInput,
          categoryList,
          h('label', { class: 'inline' }, permanent, ` ${T.permanent}`),
          maskBtn,
        ),
        h('p', { class: 'hint', text: T.maskHint }),
        inputStatus,
      ),
      reviewSection,
      h(
        'section',
        { 'aria-labelledby': 'h-reply' },
        h('h2', { id: 'h-reply', text: T.step3 }),
        field('reply', T.replyLabel, reply),
        h('div', { class: 'row' }, restoreBtn),
        field('restored', T.restoredLabel, restored),
        h('div', { class: 'row' }, copyRestoredBtn),
        report,
      ),
      h(
        'details',
        { id: 'settings' },
        h('summary', { text: T.settings }),
        h('h3', { text: T.detectors }),
        detectorList,
        field('domains', T.domainsLabel, domainsInput),
      ),
      h(
        'details',
        { id: 'directory' },
        h('summary', { text: T.directory }),
        h('p', { class: 'hint', text: T.directoryWarning }),
        field('dir-term', T.termLabel, dirTerm),
        field('dir-category', T.categoryLabel, dirCategory),
        field('dir-aliases', T.aliasesLabel, dirAliases),
        h('div', { class: 'row' }, dirAdd),
        dirStatus,
        dirList,
        h('div', { class: 'row' }, exportJsonBtn, exportCsvBtn),
        field('dir-import', T.importLabel, importFile),
      ),
      h(
        'details',
        { id: 'session' },
        h('summary', { text: T.session }),
        sessionInfo,
        h('p', { class: 'hint', text: T.sessionHint }),
        field('passphrase', T.passphraseLabel, passphrase),
        h('div', { class: 'row' }, saveSessionBtn, loadSessionBtn, deleteSessionBtn),
        h('div', { class: 'row' }, newSessionBtn, wipeBtn),
        sessionStatus,
      ),
    ),
    h('footer', {}, h('p', { class: 'hint', text: T.footer })),
  );

  renderDetectors();
  renderDirectory();
  refreshSessionInfo();
  return model;
}
