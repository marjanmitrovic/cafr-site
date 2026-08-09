const FACR_MEMBERS_URL = 'https://upgrade4.is.fotbal.cz/members';
const SEARCH_KEYS = ['search', 'query', 'q', 'searchTerm', 'searchText', 'filter', 'term', 'text'];

export function normalizeFacrId(value) {
  const digits = String(value || '').trim().replace(/\D+/g, '');
  return digits.replace(/^0+(?=\d)/, '');
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)));
}

function plainText(html) {
  return decodeHtml(String(html || ''))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('cs-CZ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resultCount(text) {
  const normalized = text.replace(/\u00a0/g, ' ');
  const match = normalized.match(/Našli\s+jsme\s+([0-9\s]+)\s+záznam/i)
    || normalized.match(/Found\s+([0-9\s]+)\s+record/i);
  if (!match) return null;
  const value = Number(String(match[1]).replace(/\s+/g, ''));
  return Number.isFinite(value) ? value : null;
}

function matchMember(text, facrId, surname) {
  const id = normalizeFacrId(facrId);
  const normalizedSurname = normalizeName(surname);
  if (!id || !normalizedSurname) return false;

  const count = resultCount(text);
  // If a candidate parameter is ignored, the public page returns the full
  // database. Do not accept a match from an unfiltered page.
  if (count !== null && count > 50) return false;

  const normalizedText = normalizeName(text);
  const idIndex = normalizedText.indexOf(id);
  if (idIndex < 0) return false;

  const from = Math.max(0, idIndex - 180);
  const to = Math.min(normalizedText.length, idIndex + id.length + 260);
  return normalizedText.slice(from, to).includes(normalizedSurname);
}

async function fetchCandidate(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'UCFR-Membership-Verification/1.0 (+https://ucfr.cz)',
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return plainText(await response.text());
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyFacrMember({ facrId, surname }) {
  const id = normalizeFacrId(facrId);
  const cleanSurname = String(surname || '').trim();
  if (!id || !cleanSurname) {
    return { verified: false, reason: 'INVALID_INPUT', source: FACR_MEMBERS_URL };
  }

  const urls = SEARCH_KEYS.map((key) => {
    const url = new URL(FACR_MEMBERS_URL);
    url.searchParams.set('discipline', 'football');
    url.searchParams.set(key, id);
    return url.href;
  });

  const settled = await Promise.allSettled(urls.map((url) => fetchCandidate(url)));
  let reachable = false;

  for (let index = 0; index < settled.length; index += 1) {
    const item = settled[index];
    if (item.status !== 'fulfilled' || !item.value) continue;
    reachable = true;
    if (matchMember(item.value, id, cleanSurname)) {
      return {
        verified: true,
        facrId: id,
        surname: cleanSurname,
        source: urls[index],
      };
    }
  }

  return {
    verified: false,
    facrId: id,
    surname: cleanSurname,
    reason: reachable ? 'NOT_FOUND' : 'SOURCE_UNAVAILABLE',
    source: FACR_MEMBERS_URL,
  };
}
