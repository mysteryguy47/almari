/**
 * Offline search that forgives typos and understands Hinglish: "pen card"
 * finds PAN, "adhar" finds Aadhaar, "gaadi" finds the car's papers.
 */
import { displayName, findMember, visibleTo } from './access';
import { getCategory, getTemplate, type Template } from './templates';
import type { Family, ID } from './types';

export type HitKind = 'person' | 'doc' | 'login' | 'bank' | 'card' | 'note' | 'task' | 'contact' | 'template';

export interface SearchEntry {
  kind: HitKind;
  id: ID;
  title: string;
  subtitle?: string;
  /** Extra words that should find this entry. */
  keywords: string[];
  /** Looser context (the category's words): matches rank below the entry's own words. */
  context?: string[];
}

export interface SearchHit extends SearchEntry {
  score: number;
}

export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-෿]+/g, ' ')
    .trim();
}

export function tokens(text: string): string[] {
  return normalise(text).split(' ').filter(Boolean);
}

/** Levenshtein distance with an early exit once it exceeds `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

function allowedTypos(token: string): number {
  if (token.length >= 7) return 2;
  if (token.length >= 3) return 1;
  return 0;
}

function contextScore(queryToken: string, words: string[]): number {
  let best = 0;
  for (const word of words) {
    if (word === queryToken) return 1.5;
    if (queryToken.length >= 3 && word.startsWith(queryToken)) best = 1;
  }
  return best;
}

function tokenScore(queryToken: string, words: string[], joined: string): number {
  let best = 0;
  for (const word of words) {
    if (word === queryToken) return 3;
    if (word.startsWith(queryToken)) best = Math.max(best, 2);
    else {
      const typos = allowedTypos(queryToken);
      if (typos > 0 && editDistance(queryToken, word, typos) <= typos) best = Math.max(best, 1.25);
    }
  }
  if (best === 0 && queryToken.length >= 3 && joined.includes(queryToken)) best = 1;
  return best;
}

export function searchEntries(query: string, entries: readonly SearchEntry[], limit = 30): SearchHit[] {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const entry of entries) {
    const text = [entry.title, entry.subtitle ?? '', ...entry.keywords].join(' ');
    const words = tokens(text);
    const joined = words.join('');
    const contextWords = tokens((entry.context ?? []).join(' '));
    let score = 0;
    let matchedAll = true;
    for (const qt of queryTokens) {
      const s = Math.max(tokenScore(qt, words, joined), contextScore(qt, contextWords));
      if (s === 0) {
        matchedAll = false;
        break;
      }
      score += s;
    }
    if (matchedAll) {
      // Titles that start with the query rank first.
      if (normalise(entry.title).startsWith(normalise(query))) score += 1;
      hits.push({ ...entry, score });
    }
  }
  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

function templateWords(template: Template): string[] {
  return [template.name, ...(template.synonyms ?? [])];
}

function categoryWords(template: Template): string[] {
  const category = getCategory(template.category);
  return [category.name, ...category.synonyms];
}

/** Everything the viewer can see, as search entries. */
export function buildIndex(family: Family, viewerId: ID): SearchEntry[] {
  const entries: SearchEntry[] = [];
  const nameOf = (id?: ID) => (id ? displayName(findMember(family, id)) : 'Family');

  for (const m of family.members) {
    entries.push({
      kind: 'person', id: m.id, title: m.fullName, subtitle: m.relation,
      keywords: [m.relation ?? '', m.email ?? '', ...Object.values(m.ids).filter(Boolean) as string[]],
    });
  }
  for (const doc of visibleTo(family, viewerId, family.documents)) {
    const template = getTemplate(doc.templateId);
    entries.push({
      kind: 'doc', id: doc.id, title: doc.title, subtitle: doc.ownerId ? nameOf(doc.ownerId) : 'Family papers',
      keywords: [...templateWords(template), doc.number ?? '', (doc.number ?? '').replace(/\s/g, ''), doc.original ?? '', doc.description ?? ''],
      context: categoryWords(template),
    });
  }
  for (const login of visibleTo(family, viewerId, family.logins)) {
    entries.push({
      kind: 'login', id: login.id, title: login.title, subtitle: login.username,
      keywords: [login.website ?? '', 'password', 'login', login.kind === 'wifi' ? 'wifi wi-fi internet' : ''],
    });
  }
  for (const account of visibleTo(family, viewerId, family.bankAccounts)) {
    entries.push({
      kind: 'bank', id: account.id, title: `${account.bank} account`, subtitle: nameOf(account.ownerId),
      keywords: ['bank', 'account', 'khata', account.ifsc ?? '', account.type],
    });
  }
  for (const card of visibleTo(family, viewerId, family.cards)) {
    entries.push({
      kind: 'card', id: card.id, title: `${card.bank} ${card.nickname ?? card.type + ' card'}`, subtitle: nameOf(card.ownerId),
      keywords: ['card', card.type, card.network, 'credit', 'debit'],
    });
  }
  for (const note of visibleTo(family, viewerId, family.notes)) {
    entries.push({ kind: 'note', id: note.id, title: note.title, keywords: ['note'] });
  }
  for (const task of family.tasks.filter((t) => !t.deletedAt)) {
    entries.push({ kind: 'task', id: task.id, title: task.title, subtitle: task.done ? 'Done' : 'To-do', keywords: ['task', 'kaam', 'todo'] });
  }
  for (const contact of family.contacts) {
    entries.push({ kind: 'contact', id: contact.id, title: contact.name, subtitle: contact.role, keywords: [contact.role, contact.phone, 'number'] });
  }
  return entries;
}

/** Templates as entries, for "What are you adding?". */
export function templateEntries(templates: readonly Template[]): SearchEntry[] {
  return templates.map((tpl) => ({
    kind: 'template' as const, id: tpl.id, title: tpl.name, subtitle: getCategory(tpl.category).name,
    keywords: templateWords(tpl),
    context: categoryWords(tpl),
  }));
}
