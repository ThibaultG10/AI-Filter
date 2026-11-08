// Stockage local du navigateur, entouré de try/catch : il peut être absent ou bloqué.

import type { DirectoryEntry } from '../core/directory';
import { importJson, exportJson } from '../core/directory-io';
import type { Lang } from '../config/texts';
import { DEFAULT_SETTINGS, type Settings } from './model';

const KEY_SETTINGS = 'filtre-ia/settings/v1';
const KEY_DIRECTORY = 'filtre-ia/directory/v1';
const KEY_SESSION = 'filtre-ia/session/v1';
const KEY_LANG = 'filtre-ia/lang/v1';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStore(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export class Storage {
  constructor(private readonly store: KeyValueStore | null = defaultStore()) {}

  private read(key: string): string | null {
    try {
      return this.store?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): boolean {
    try {
      if (!this.store) return false;
      this.store.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  private remove(key: string): void {
    try {
      this.store?.removeItem(key);
    } catch {
      /* ignoré */
    }
  }

  loadSettings(): Settings {
    const raw = this.read(KEY_SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS, enabled: {}, internalDomains: [] };
    try {
      const data = JSON.parse(raw) as { enabled?: unknown; internalDomains?: unknown };
      const enabled: Record<string, boolean> = {};
      if (data.enabled && typeof data.enabled === 'object') {
        for (const [k, v] of Object.entries(data.enabled)) if (typeof v === 'boolean') enabled[k] = v;
      }
      const domains = Array.isArray(data.internalDomains)
        ? data.internalDomains.filter((d): d is string => typeof d === 'string').slice(0, 200)
        : [];
      return { enabled, internalDomains: domains };
    } catch {
      return { ...DEFAULT_SETTINGS, enabled: {}, internalDomains: [] };
    }
  }

  saveSettings(settings: Settings): boolean {
    return this.write(KEY_SETTINGS, JSON.stringify(settings));
  }

  loadDirectory(): DirectoryEntry[] {
    const raw = this.read(KEY_DIRECTORY);
    return raw ? importJson(raw).entries : [];
  }

  saveDirectory(entries: readonly DirectoryEntry[]): boolean {
    return this.write(KEY_DIRECTORY, exportJson(entries));
  }

  loadLang(): Lang | null {
    const v = this.read(KEY_LANG);
    return v === 'fr' || v === 'en' ? v : null;
  }

  saveLang(lang: Lang): void {
    this.write(KEY_LANG, lang);
  }

  loadEncryptedSession(): string | null {
    return this.read(KEY_SESSION);
  }

  saveEncryptedSession(payload: string): boolean {
    return this.write(KEY_SESSION, payload);
  }

  clearEncryptedSession(): void {
    this.remove(KEY_SESSION);
  }

  /** Efface tout ce que l'application a pu écrire. */
  clearAll(): void {
    this.remove(KEY_SETTINGS);
    this.remove(KEY_DIRECTORY);
    this.remove(KEY_SESSION);
    this.remove(KEY_LANG);
  }
}
