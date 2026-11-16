/**
 * Bank and branch from an IFSC, looked up online when there is internet
 * (Razorpay's free public IFSC directory). Only the IFSC is sent: it is a
 * public branch code, not anything about the person. Offline, the form works
 * as before and the branch can be typed.
 */
export interface IfscInfo {
  bank: string;
  branch: string;
  city?: string;
}

export type IfscLookup = { status: 'found'; info: IfscInfo } | { status: 'unknown' } | { status: 'offline' };

const cache = new Map<string, IfscInfo | null>();

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|[\s(/-])([a-z])/g, (_, gap: string, c: string) => gap + c.toUpperCase());
}

export async function lookupIfsc(code: string): Promise<IfscLookup> {
  const ifsc = code.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return { status: 'unknown' };
  if (cache.has(ifsc)) {
    const hit = cache.get(ifsc);
    return hit ? { status: 'found', info: hit } : { status: 'unknown' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`https://ifsc.razorpay.com/${ifsc}`, { signal: controller.signal });
    if (response.status === 404) {
      cache.set(ifsc, null);
      return { status: 'unknown' };
    }
    if (!response.ok) return { status: 'offline' };
    const data = (await response.json()) as { BANK?: string; BRANCH?: string; CITY?: string };
    if (!data.BANK || !data.BRANCH) return { status: 'unknown' };
    const info = { bank: data.BANK, branch: titleCase(data.BRANCH), city: data.CITY ? titleCase(data.CITY) : undefined };
    cache.set(ifsc, info);
    return { status: 'found', info };
  } catch {
    return { status: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}
