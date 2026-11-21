/**
 * Papers whose issuing office has a logo everyone knows, by template id, and
 * the file in assets/logos/docs that holds it. Every other paper has a
 * picture of its own in assets/logos/papers.
 */
/** Papers whose issuing office has a logo everyone knows. The passport gets its cover: gold emblem on navy. */
export const ISSUER_LOGO: Record<string, { logo: string; background?: string }> = {
  aadhaar: { logo: 'aadhaar' },
  pan: { logo: 'income-tax' },
  itr: { logo: 'income-tax' },
  'form-16': { logo: 'income-tax' },
  'voter-id': { logo: 'eci' },
  passport: { logo: 'emblem-gold', background: '#1D2A5A' },
  nps: { logo: 'pfrda' },
  fastag: { logo: 'fastag' },
  fssai: { logo: 'fssai' },
  'esic-card': { logo: 'esic' },
  'pf-passbook': { logo: 'epfo' },
  'ayushman-card': { logo: 'pmjay' },
  udyam: { logo: 'msme' },
  'post-office-passbook': { logo: 'india-post' },
};
