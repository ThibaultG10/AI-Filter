import { DEFAULT_CATEGORY, makeEntry, type DirectoryEntry } from './directory';
import { normalizeKey } from './normalize';

// Import / export de l'annuaire en JSON et en CSV. Les lignes invalides sont signalées,
// jamais jetées en silence, et n'empêchent pas l'import des lignes valides.

/** Nombre maximal d'entrées par import (évite de figer le navigateur). */
export const MAX_ENTRIES = 50_000;

export interface ImportError {
  /** Ligne du CSV, ou position (à partir de 1) dans le tableau JSON ; 0 pour une erreur globale. */
  line: number;
  message: string;
}

export interface ImportResult {
  entries: DirectoryEntry[];
  errors: ImportError[];
}

const globalError = (message: string): ImportResult => ({ entries: [], errors: [{ line: 0, message }] });

// --- JSON -------------------------------------------------------------------

export function exportJson(entries: readonly DirectoryEntry[]): string {
  return JSON.stringify({ version: 1, entries }, null, 2) + '\n';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pick(record: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(record, name)) return record[name];
  }
  return undefined;
}

function toAliasList(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (typeof value === 'string') return value.split('|');
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return value as string[];
  return null;
}

/** Accepte un tableau d'entrées ou { "entries": [...] }. Clés : term/terme, category/categorie, aliases/alias. */
export function importJson(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return globalError('JSON invalide.');
  }
  const list = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data['entries']) ? data['entries'] : null;
  if (list === null) return globalError('Format inattendu : un tableau, ou un objet avec une clé « entries », est attendu.');
  if (list.length > MAX_ENTRIES) return globalError(`Trop d'entrées (${MAX_ENTRIES} maximum par import).`);

  const entries: DirectoryEntry[] = [];
  const errors: ImportError[] = [];
  list.forEach((item: unknown, index: number) => {
    const line = index + 1;
    if (!isRecord(item)) {
      errors.push({ line, message: 'Entrée ignorée : un objet est attendu.' });
      return;
    }
    const term = pick(item, 'term', 'terme');
    if (typeof term !== 'string') {
      errors.push({ line, message: 'Entrée ignorée : le terme est absent ou n\'est pas un texte.' });
      return;
    }
    const category = pick(item, 'category', 'categorie', 'catégorie');
    if (category !== undefined && typeof category !== 'string') {
      errors.push({ line, message: 'Entrée ignorée : la catégorie doit être un texte.' });
      return;
    }
    const aliases = toAliasList(pick(item, 'aliases', 'alias'));
    if (aliases === null) {
      errors.push({ line, message: 'Entrée ignorée : les alias doivent être une liste de textes.' });
      return;
    }
    const result = makeEntry(term, category && category.trim() !== '' ? category : DEFAULT_CATEGORY, aliases);
    if (result.ok) entries.push(result.entry);
    else errors.push({ line, message: result.error });
  });
  return { entries, errors };
}

// --- CSV --------------------------------------------------------------------

const FORMULA_START = /^[=+\-@\t\r]/;

/** Protège contre l'injection de formules à l'ouverture dans un tableur. */
function csvField(value: string, delimiter: string): string {
  let v = FORMULA_START.test(value) ? `'${value}` : value;
  if (v.includes('"') || v.includes(delimiter) || /[\n\r]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Retire l'apostrophe de protection ajoutée à l'export. */
function unprotect(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

/** Colonnes : terme, categorie, alias (alias séparés par « | »). Séparateur « ; » par défaut (Excel en français). */
export function exportCsv(entries: readonly DirectoryEntry[], delimiter = ';'): string {
  const lines = [['terme', 'categorie', 'alias'].join(delimiter)];
  for (const e of entries) {
    lines.push(
      [e.term, e.category, e.aliases.join('|')].map((field) => csvField(field, delimiter)).join(delimiter),
    );
  }
  return lines.join('\n') + '\n';
}

interface CsvRow {
  cells: string[];
  /** Ligne de début de l'enregistrement (à partir de 1). */
  line: number;
}

function detectDelimiter(text: string): string {
  let semicolons = 0;
  let commas = 0;
  let tabs = 0;
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '\n' || ch === '\r') {
      if (!inQuotes) break;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === ';') semicolons++;
      else if (ch === ',') commas++;
      else if (ch === '\t') tabs++;
    }
  }
  if (tabs > 0 && tabs >= semicolons && tabs >= commas) return '\t';
  return semicolons > commas ? ';' : ',';
}

function parseCsv(text: string, delimiter: string): { rows: CsvRow[]; unterminatedLine: number | null } {
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let rowLine = 1;

  const endRow = (): void => {
    cells.push(field);
    field = '';
    const blank = cells.length === 1 && (cells[0] ?? '').trim() === '';
    if (!blank) rows.push({ cells, line: rowLine });
    cells = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? '';
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
    } else if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRow();
      line++;
      rowLine = line;
    } else {
      field += ch;
    }
  }
  if (inQuotes) return { rows, unterminatedLine: rowLine };
  if (field !== '' || cells.length > 0) endRow();
  return { rows, unterminatedLine: null };
}

/**
 * Import CSV. Séparateur détecté automatiquement (« ; », « , » ou tabulation).
 * Avec une ligne d'en-tête (terme/term, categorie/category, alias/aliases) l'ordre des colonnes
 * est libre ; sans en-tête : terme, catégorie, alias. Catégorie absente : INTERNE.
 */
export function importCsv(text: string): ImportResult {
  const source = text.replace(/^﻿/, '');
  const parsed = parseCsv(source, detectDelimiter(source));
  const rows = parsed.rows;
  const unterminated: ImportError[] =
    parsed.unterminatedLine === null
      ? []
      : [
          {
            line: parsed.unterminatedLine,
            message: 'Guillemet non fermé : la fin du fichier est atteinte, cette ligne est ignorée.',
          },
        ];
  if (rows.length === 0) return { entries: [], errors: unterminated };

  const first = rows[0]!;
  const keys = first.cells.map((c) => normalizeKey(c));
  const termColumn = keys.findIndex((k) => k === 'term' || k === 'terme' || k === 'nom');
  const hasHeader = termColumn !== -1;
  const columns = hasHeader
    ? {
        term: termColumn,
        category: keys.findIndex((k) => k === 'category' || k === 'categorie'),
        aliases: keys.findIndex((k) => k === 'aliases' || k === 'alias'),
      }
    : { term: 0, category: 1, aliases: 2 };
  const dataRows = hasHeader ? rows.slice(1) : rows;
  if (dataRows.length > MAX_ENTRIES) return globalError(`Trop d'entrées (${MAX_ENTRIES} maximum par import).`);

  const cell = (row: CsvRow, index: number): string => (index >= 0 ? unprotect((row.cells[index] ?? '').trim()) : '');

  const entries: DirectoryEntry[] = [];
  const errors: ImportError[] = [];
  for (const row of dataRows) {
    const term = cell(row, columns.term);
    if (term === '') {
      errors.push({ line: row.line, message: 'Ligne ignorée : le terme est vide.' });
      continue;
    }
    const category = cell(row, columns.category);
    const result = makeEntry(term, category === '' ? DEFAULT_CATEGORY : category, cell(row, columns.aliases).split('|'));
    if (result.ok) entries.push(result.entry);
    else errors.push({ line: row.line, message: result.error });
  }
  return { entries, errors: [...errors, ...unterminated] };
}
