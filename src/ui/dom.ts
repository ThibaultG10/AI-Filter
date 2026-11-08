// Petits utilitaires DOM (aucun innerHTML : tout le texte passe par textContent).

type Child = Node | string | null | undefined | false;

export interface Props {
  class?: string;
  id?: string;
  text?: string;
  [attr: string]: string | boolean | undefined;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (name === 'class') el.className = String(value);
    else if (name === 'text') el.textContent = String(value);
    else if (value === true) el.setAttribute(name, '');
    else el.setAttribute(name, String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Copie dans le presse-papiers ; repli par sélection + execCommand si l'API est indisponible (file://). */
export async function copyText(text: string, fallback: HTMLTextAreaElement): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* repli ci-dessous */
  }
  try {
    fallback.focus();
    fallback.select();
    return document.execCommand('copy');
  } catch {
    return false;
  }
}

/** Télécharge un contenu texte sous forme de fichier, sans réseau. */
export function downloadText(fileName: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: fileName });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
