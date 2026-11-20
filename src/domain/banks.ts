/**
 * Banks in India, for typing a bank name in two letters ("sb" → State Bank
 * of India) and for the bank's mark on accounts and cards.
 *
 * Each bank has its usual short name, the older names people still use
 * ("Vijaya Bank", "Corporation Bank", "Aryavart Bank"), the first four
 * letters of its IFSC where known (which also names its logo in
 * assets/logos/banks), and a colour close to its own: the colour of its
 * cards, and of the mark drawn for banks without a logo.
 */
import { compactUpper } from './validation';

export type BankKind = 'public' | 'private' | 'small-finance' | 'payments' | 'foreign' | 'cooperative' | 'rural' | 'issuer';

export interface Bank {
  name: string;
  /** What people call it, and what the mark shows: "SBI", "HDFC", "CANARA". At most 6 letters. */
  short: string;
  kind: BankKind;
  /** The first four letters of its IFSC. */
  ifsc?: string;
  /** Close to the bank's own colour. Absent: one is picked from the name. */
  color?: string;
  /** Other names that should find it: old names of merged banks, nicknames. */
  aka?: string[];
  /** Its logo's name, when it is not the IFSC's first four letters: an issuer that borrows its bank's logo. */
  logo?: string;
}

const b = (name: string, short: string, kind: BankKind, ifsc?: string, color?: string, aka?: string[], logo?: string): Bank => ({ name, short, kind, ifsc, color, aka, logo });

export const BANKS: readonly Bank[] = [
  // ------------------------------------------------ Public sector
  b('State Bank of India', 'SBI', 'public', 'SBIN', '#1E4A9A', ['sbi', 'state bank', 'yono', 'state bank of bikaner', 'state bank of patiala', 'state bank of hyderabad', 'state bank of mysore', 'state bank of travancore', 'bharatiya mahila bank']),
  b('Punjab National Bank', 'PNB', 'public', 'PUNB', '#A0153E', ['pnb', 'oriental bank of commerce', 'obc', 'united bank of india']),
  b('Bank of Baroda', 'BoB', 'public', 'BARB', '#E2561C', ['bob', 'baroda', 'vijaya bank', 'dena bank']),
  b('Canara Bank', 'CANARA', 'public', 'CNRB', '#0A6FB3', ['canara', 'syndicate bank']),
  b('Union Bank of India', 'UNION', 'public', 'UBIN', '#C8202F', ['union bank', 'ubi', 'andhra bank', 'corporation bank']),
  b('Bank of India', 'BOI', 'public', 'BKID', '#E8741E', ['boi', 'star']),
  b('Indian Bank', 'INDIAN', 'public', 'IDIB', '#1D3F8A', ['indian bank', 'allahabad bank']),
  b('Central Bank of India', 'CBI', 'public', 'CBIN', '#C62032', ['central bank', 'cbi']),
  b('Indian Overseas Bank', 'IOB', 'public', 'IOBA', '#0D4C9E', ['iob']),
  b('UCO Bank', 'UCO', 'public', 'UCBA', '#0B5CA8', ['uco', 'united commercial bank']),
  b('Bank of Maharashtra', 'BoM', 'public', 'MAHB', '#D3242C', ['bom', 'mahabank', 'maharashtra bank']),
  b('Punjab & Sind Bank', 'P&S', 'public', 'PSIB', '#127A3E', ['psb', 'punjab and sind bank', 'punjab sind']),

  // ------------------------------------------------ Private sector
  b('HDFC Bank', 'HDFC', 'private', 'HDFC', '#0B4A8F', ['hdfc', 'hdfc bank']),
  b('ICICI Bank', 'ICICI', 'private', 'ICIC', '#A8262C', ['icici']),
  b('Axis Bank', 'AXIS', 'private', 'UTIB', '#8E1849', ['axis', 'uti bank', 'citibank india retail']),
  b('Kotak Mahindra Bank', 'KOTAK', 'private', 'KKBK', '#D7262B', ['kotak', '811', 'ing vysya']),
  b('IndusInd Bank', 'INDUS', 'private', 'INDB', '#8A2430', ['indusind', 'indus']),
  b('Yes Bank', 'YES', 'private', 'YESB', '#0D4DA1', ['yes']),
  b('IDFC FIRST Bank', 'IDFC', 'private', 'IDFB', '#9A1C25', ['idfc', 'idfc first', 'capital first']),
  b('IDBI Bank', 'IDBI', 'private', 'IBKL', '#00806A', ['idbi']),
  b('Federal Bank', 'FED', 'private', 'FDRL', '#1C4D9B', ['federal', 'fedbank', 'fi money', 'jupiter']),
  b('RBL Bank', 'RBL', 'private', 'RATN', '#21418F', ['rbl', 'ratnakar bank']),
  b('Bandhan Bank', 'BAND', 'private', 'BDBL', '#C2202F', ['bandhan']),
  b('South Indian Bank', 'SIB', 'private', 'SIBL', '#A11D2B', ['sib', 'south indian']),
  b('Karnataka Bank', 'KBL', 'private', 'KARB', '#7E2A8A', ['kbl', 'karnataka bank']),
  b('Karur Vysya Bank', 'KVB', 'private', 'KVBL', '#1E7A3A', ['kvb', 'karur vysya']),
  b('City Union Bank', 'CUB', 'private', 'CIUB', '#C72A2F', ['cub', 'city union']),
  b('Tamilnad Mercantile Bank', 'TMB', 'private', 'TMBL', '#1A4E91', ['tmb', 'tamilnad mercantile']),
  b('DCB Bank', 'DCB', 'private', 'DCBL', '#1F3B7A', ['dcb', 'development credit bank']),
  b('Dhanlaxmi Bank', 'DLB', 'private', 'DLXB', '#9F1F2E', ['dhanlaxmi', 'dhanalakshmi']),
  b('CSB Bank', 'CSB', 'private', 'CSBK', '#B2232F', ['csb', 'catholic syrian bank']),
  b('Jammu & Kashmir Bank', 'J&K', 'private', 'JAKA', '#1C6E3D', ['j&k bank', 'jk bank', 'jammu and kashmir bank']),
  b('Nainital Bank', 'NTB', 'private', 'NTBL', '#1A4F8C', ['nainital']),

  // ------------------------------------------------ Small finance banks
  b('AU Small Finance Bank', 'AU', 'small-finance', 'AUBL', '#5E2A84', ['au bank', 'au sfb', 'fincare']),
  b('Equitas Small Finance Bank', 'EQTS', 'small-finance', 'ESFB', '#E0761F', ['equitas']),
  b('Ujjivan Small Finance Bank', 'UJJVN', 'small-finance', 'UJVN', '#1B5E9E', ['ujjivan']),
  b('Jana Small Finance Bank', 'JANA', 'small-finance', 'JSFB', '#0F6C7A', ['jana']),
  b('Suryoday Small Finance Bank', 'SURY', 'small-finance', 'SURY', '#E08A1E', ['suryoday']),
  b('ESAF Small Finance Bank', 'ESAF', 'small-finance', 'ESMF', '#2E7D32', ['esaf']),
  b('Utkarsh Small Finance Bank', 'UTKSH', 'small-finance', 'UTKS', '#1C5A9E', ['utkarsh']),
  b('Capital Small Finance Bank', 'CAP', 'small-finance', 'CLBL', '#C8202F', ['capital bank']),
  b('Shivalik Small Finance Bank', 'SHIV', 'small-finance', 'SMCB', '#0D5A8C', ['shivalik']),
  b('Unity Small Finance Bank', 'UNITY', 'small-finance', 'UNBA', '#C9A227', ['unity', 'pmc bank', 'punjab and maharashtra co-operative bank']),
  b('slice Small Finance Bank', 'SLICE', 'small-finance', 'NESF', '#9B0FB8', ['slice', 'north east small finance bank']),

  // ------------------------------------------------ Payments banks
  b('India Post Payments Bank', 'IPPB', 'payments', 'IPOS', '#C8202E', ['ippb', 'post office', 'post office savings', 'dak ghar', 'india post']),
  b('Airtel Payments Bank', 'AIRTL', 'payments', 'AIRP', '#D81E1E', ['airtel']),
  b('Paytm Payments Bank', 'PAYTM', 'payments', 'PYTM', '#0B2D6B', ['paytm']),
  b('Fino Payments Bank', 'FINO', 'payments', 'FINO', '#6A2C8E', ['fino']),
  b('Jio Payments Bank', 'JIO', 'payments', 'JIOP', '#0A3A8C', ['jio']),
  b('NSDL Payments Bank', 'NSDL', 'payments', 'NSPB', undefined, ['nsdl']),

  // ------------------------------------------------ Foreign banks
  b('HSBC', 'HSBC', 'foreign', 'HSBC', '#C8102E', ['hongkong and shanghai banking']),
  b('Standard Chartered', 'SC', 'foreign', 'SCBL', '#0A6BC9', ['stanchart', 'standard chartered bank', 'scb']),
  b('Citibank', 'CITI', 'foreign', 'CITI', '#0B4F9C', ['citi']),
  b('DBS Bank India', 'DBS', 'foreign', 'DBSS', '#D2232F', ['dbs', 'digibank', 'lakshmi vilas bank', 'lvb']),
  b('Deutsche Bank', 'DB', 'foreign', 'DEUT', '#0018A8', ['deutsche']),
  b('Barclays Bank', 'BRCLY', 'foreign', 'BARC', '#00AEEF', ['barclays']),
  b('Bank of America', 'BofA', 'foreign', 'BOFA', '#C8102E', ['bofa']),
  b('JPMorgan Chase Bank', 'JPM', 'foreign', 'CHAS', '#5E4B3C', ['jp morgan', 'chase']),
  b('BNP Paribas', 'BNP', 'foreign', 'BNPA', '#00915A', ['bnp']),
  b('SBM Bank India', 'SBM', 'foreign', 'STCB', undefined, ['sbm']),
  b('Crédit Agricole', 'CA', 'foreign', 'CRLY', undefined, ['credit agricole']),
  b('Emirates NBD', 'ENBD', 'foreign', 'EBIL', '#0B2D5B', ['emirates']),
  b('Mashreq Bank', 'MASHR', 'foreign', 'MSHQ', '#E5591C', ['mashreq']),
  b('MUFG Bank', 'MUFG', 'foreign', 'BOTM', '#D6001C', ['bank of tokyo', 'mitsubishi']),
  b('Mizuho Bank', 'MIZHO', 'foreign', 'MHCB', '#1B2A6B', ['mizuho']),
  b('Sumitomo Mitsui Banking Corporation', 'SMBC', 'foreign', 'SMBC', '#4E7A23', ['smbc', 'sumitomo']),
  b('Shinhan Bank', 'SHNHN', 'foreign', 'SHBK', '#0046A5', ['shinhan']),
  b('Woori Bank', 'WOORI', 'foreign', 'HVBK', '#0067AC', ['woori']),
  b('KEB Hana Bank', 'HANA', 'foreign', 'KOEX', '#008C73', ['hana']),
  b('Qatar National Bank', 'QNB', 'foreign', 'QNBA', '#5A1A3C', ['qnb']),
  b('Doha Bank', 'DOHA', 'foreign', 'DOHB', undefined, ['doha']),
  b('First Abu Dhabi Bank', 'FAB', 'foreign', 'NBAD', '#1E3E8C', ['fab', 'abu dhabi']),
  b('Bank of Ceylon', 'BOC', 'foreign', 'BCEY', '#1C1C1C', ['ceylon']),
  b('Société Générale', 'SG', 'foreign', 'SOGE', '#C8102E', ['societe generale', 'socgen']),
  b('United Overseas Bank', 'UOB', 'foreign', 'UOVB', '#1E3A8A', ['uob']),
  b('Industrial and Commercial Bank of China', 'ICBC', 'foreign', 'ICBK', '#C8102E', ['icbc']),
  b('CTBC Bank', 'CTBC', 'foreign', 'CTCB', '#C8102E', ['ctbc', 'chinatrust']),
  b('Rabobank', 'RABO', 'foreign', 'RABO', '#E9600E', ['rabo']),
  b('NatWest Markets', 'NWM', 'foreign', 'ABNA', '#42145F', ['natwest', 'rbs', 'royal bank of scotland', 'abn amro']),
  b('ANZ Bank', 'ANZ', 'foreign', 'ANZB', '#007DBA', ['anz', 'australia and new zealand banking']),
  b('KB Kookmin Bank', 'KB', 'foreign', 'KBKB', '#8A6D3B', ['kookmin']),
  b('Industrial Bank of Korea', 'IBK', 'foreign', 'IBKO', '#0B4EA2', ['ibk']),
  b('Sberbank', 'SBER', 'foreign', 'SABR', '#1A9F29', ['sber']),
  b('FirstRand Bank', 'FRB', 'foreign', 'FIRN', '#0B3D91', ['firstrand', 'first national bank']),
  b('Bank of Bahrain and Kuwait', 'BBK', 'foreign', 'BBKM', '#B8862B', ['bbk']),
  b('Scotiabank', 'SCOTIA', 'foreign', 'NOSC', '#EC111A', ['bank of nova scotia', 'scotia']),
  b('Sonali Bank', 'SONALI', 'foreign', 'SBLD', '#B88A1E', ['sonali']),
  b('AB Bank', 'AB', 'foreign', 'ABBL', '#C8202F', ['ab bank bangladesh']),
  b('Maybank', 'MAY', 'foreign', 'IBBK', '#B8860B', ['malayan banking']),

  // ------------------------------------------------ Co-operative banks
  b('Saraswat Co-operative Bank', 'SARAS', 'cooperative', 'SRCB', '#B5262B', ['saraswat']),
  b('Cosmos Co-operative Bank', 'COSMS', 'cooperative', 'COSB', '#1D4E9A', ['cosmos']),
  b('SVC Co-operative Bank', 'SVC', 'cooperative', 'SVCB', undefined, ['svc', 'shamrao vithal']),
  b('TJSB Sahakari Bank', 'TJSB', 'cooperative', 'TJSB', undefined, ['tjsb', 'thane janata']),
  b('Abhyudaya Co-operative Bank', 'ABHY', 'cooperative', 'ABHY', undefined, ['abhyudaya']),
  b('NKGSB Co-operative Bank', 'NKGSB', 'cooperative', 'NKGS', undefined, ['nkgsb']),
  b('Bharat Co-operative Bank (Mumbai)', 'BCB', 'cooperative', 'BCBM', undefined, ['bharat bank', 'bharat co-op']),
  b('Kalupur Commercial Co-operative Bank', 'KALUP', 'cooperative', 'KCCB', undefined, ['kalupur']),
  b('Janata Sahakari Bank, Pune', 'JSB', 'cooperative', 'JSBP', undefined, ['janata sahakari']),
  b('Apna Sahakari Bank', 'APNA', 'cooperative', 'ASBL', undefined, ['apna bank']),
  b('Ahmedabad Mercantile Co-operative Bank', 'AMCO', 'cooperative', 'AMCB', undefined, ['amco', 'ahmedabad mercantile']),
  b('Zoroastrian Co-operative Bank', 'ZORO', 'cooperative', 'ZCBL', undefined, ['zoroastrian']),
  b('Mehsana Urban Co-operative Bank', 'MEHSN', 'cooperative', 'MSNU', undefined, ['mehsana']),
  b('Nutan Nagarik Sahakari Bank', 'NUTAN', 'cooperative', undefined, undefined, ['nutan']),
  b('Rajkot Nagarik Sahakari Bank', 'RNSB', 'cooperative', undefined, undefined, ['rnsb', 'rajkot nagarik']),
  b('Kerala Bank (Kerala State Co-operative Bank)', 'KERLA', 'cooperative', undefined, undefined, ['kerala bank', 'kerala state co-operative']),
  b('Delhi State Co-operative Bank', 'DSCB', 'cooperative', undefined, undefined, ['delhi state co-op']),
  b('Maharashtra State Co-operative Bank', 'MSCB', 'cooperative', undefined, undefined, ['mscb', 'maharashtra state co-op']),
  b('Gujarat State Co-operative Bank', 'GSCB', 'cooperative', undefined, undefined, ['gujarat state co-op']),
  b('Tamil Nadu State Apex Co-operative Bank', 'TNSC', 'cooperative', undefined, undefined, ['tnsc bank', 'tamil nadu co-op']),
  b('District Central Co-operative Bank', 'DCCB', 'cooperative', undefined, undefined, ['dccb', 'zila sahakari bank', 'district co-operative bank']),

  // ------------------------------------------------ Regional rural banks (one per state since 2025)
  b('Andhra Pradesh Grameena Bank', 'APGB', 'rural', undefined, undefined, ['apgvb', 'chaitanya godavari', 'saptagiri grameena']),
  b('Arunachal Pradesh Rural Bank', 'APRB', 'rural'),
  b('Assam Gramin Vikash Bank', 'AGVB', 'rural', undefined, undefined, ['agvb']),
  b('Bihar Gramin Bank', 'BGB', 'rural', undefined, undefined, ['dakshin bihar gramin bank', 'uttar bihar gramin bank']),
  b('Chhattisgarh Rajya Gramin Bank', 'CRGB', 'rural', undefined, undefined, ['crgb']),
  b('Gujarat Gramin Bank', 'GGB', 'rural', undefined, undefined, ['baroda gujarat gramin bank', 'saurashtra gramin bank']),
  b('Haryana Gramin Bank', 'HGB', 'rural', undefined, undefined, ['sarva haryana gramin bank']),
  b('Himachal Pradesh Gramin Bank', 'HPGB', 'rural', undefined, undefined, ['himachal gramin']),
  b('J&K Grameen Bank', 'JKGB', 'rural', undefined, undefined, ['ellaquai dehati bank']),
  b('Jharkhand Rajya Gramin Bank', 'JRGB', 'rural', undefined, undefined, ['jrgb']),
  b('Karnataka Grameena Bank', 'KAGB', 'rural', undefined, undefined, ['karnataka vikas grameena bank', 'kvgb']),
  b('Kerala Gramin Bank', 'KGB', 'rural', undefined, undefined, ['kerala gramin']),
  b('Madhya Pradesh Gramin Bank', 'MPGB', 'rural', undefined, undefined, ['madhyanchal gramin bank']),
  b('Maharashtra Gramin Bank', 'MGB', 'rural', undefined, undefined, ['vidharbha konkan gramin bank']),
  b('Manipur Rural Bank', 'MRB', 'rural'),
  b('Meghalaya Rural Bank', 'MERB', 'rural'),
  b('Mizoram Rural Bank', 'MZRB', 'rural'),
  b('Nagaland Rural Bank', 'NRB', 'rural'),
  b('Odisha Grameen Bank', 'OGB', 'rural', undefined, undefined, ['utkal grameen bank']),
  b('Puducherry Grama Bank', 'PGB', 'rural', undefined, undefined, ['puduvai bharathiar grama bank']),
  b('Punjab Gramin Bank', 'PJGB', 'rural'),
  b('Rajasthan Gramin Bank', 'RGB', 'rural', undefined, undefined, ['rajasthan marudhara gramin bank', 'baroda rajasthan kshetriya gramin bank']),
  b('Tamil Nadu Grama Bank', 'TNGB', 'rural'),
  b('Telangana Grameena Bank', 'TGB', 'rural', undefined, undefined, ['telangana grameena']),
  b('Tripura Gramin Bank', 'TRGB', 'rural'),
  b('Uttar Pradesh Gramin Bank', 'UPGB', 'rural', undefined, undefined, ['aryavart bank', 'baroda up bank', 'prathama up gramin bank']),
  b('Uttarakhand Gramin Bank', 'UKGB', 'rural'),
  b('West Bengal Gramin Bank', 'WBGB', 'rural', undefined, undefined, ['paschim banga gramin bank', 'bangiya gramin vikash bank']),

  // ------------------------------------------------ Card issuers that are not banks
  b('SBI Card', 'SBI', 'issuer', undefined, '#1A3E8C', ['sbi card', 'sbi credit card', 'simplyclick', 'cashback sbi'], 'sbin'),
  b('American Express', 'AMEX', 'issuer', undefined, '#1F6FC5', ['amex'], 'amex'),
  b('OneCard', 'ONE', 'issuer', undefined, '#2B2B2B', ['onecard', 'one card']),
];

const BY_IFSC = new Map(BANKS.filter((x) => x.ifsc).map((x) => [x.ifsc as string, x]));

function fold(text: string): string {
  return text.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

const FOLDED = BANKS.map((bank) => ({
  bank,
  name: fold(bank.name),
  short: fold(bank.short),
  words: fold(bank.name).split(' '),
  aka: (bank.aka ?? []).map(fold),
}));

/** The bank a name refers to: the exact name, the short name, or an older name. */
export function findBank(name: string | undefined): Bank | undefined {
  if (!name?.trim()) return undefined;
  const q = fold(name);
  return (
    FOLDED.find((x) => x.name === q)?.bank ??
    FOLDED.find((x) => x.short === q && x.bank.kind !== 'issuer')?.bank ??
    FOLDED.find((x) => x.aka.includes(q))?.bank ??
    FOLDED.find((x) => q.length >= 4 && x.name.replace(/ bank$/, '') === q.replace(/ bank$/, ''))?.bank
  );
}

/** Banks by the first four letters of the IFSC. */
export function bankFromIfsc(ifsc: string | undefined): Bank | undefined {
  if (!ifsc) return undefined;
  return BY_IFSC.get(compactUpper(ifsc).slice(0, 4));
}

/** The banks people pick most, for a first look before they type. */
export const POPULAR_BANKS = ['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank', 'Punjab National Bank', 'Bank of Baroda', 'Canara Bank', 'Union Bank of India', 'IndusInd Bank'];

/**
 * Suggestions as the person types: the short name or the start of a word
 * first ("hd" → HDFC Bank, "ma" → Bank of Maharashtra), then anywhere in the
 * name or an older name ("vijaya" → Bank of Baroda).
 */
export function searchBanks(query: string, limit = 6, issuers = false): Bank[] {
  const q = fold(query);
  if (!q) return [];
  const scored: { bank: Bank; score: number }[] = [];
  for (const x of FOLDED) {
    if (!issuers && x.bank.kind === 'issuer') continue;
    let score = 0;
    if (x.short === q || x.name === q) score = 100;
    else if (x.short.startsWith(q)) score = 80;
    else if (x.name.startsWith(q)) score = 70;
    else if (x.words.some((w) => w.startsWith(q))) score = 60;
    else if (x.aka.some((a) => a === q)) score = 55;
    else if (x.aka.some((a) => a.startsWith(q) || a.split(' ').some((w) => w.startsWith(q)))) score = 40;
    else if (q.length >= 3 && x.name.includes(q)) score = 30;
    if (!score) continue;
    // Bigger banks first among equals: the order of the list is roughly by size.
    scored.push({ bank: x.bank, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || BANKS.indexOf(a.bank) - BANKS.indexOf(b.bank))
    .slice(0, limit)
    .map((s) => s.bank);
}

/** Deep colours for banks without their own, picked from the name so a bank keeps its colour. */
const FALLBACK_COLOURS = ['#2C4A6E', '#4A2C5E', '#2E5A4A', '#6A3B2A', '#3A3F7A', '#5A4A2A', '#2A5A6A'];

export interface BankMarkInfo {
  /** Up to 6 characters. */
  text: string;
  color: string;
  /** The full name it stands for, when known. */
  name?: string;
  /** The logo's name, when the bank is known: "sbin", "hdfc". The screen draws it if the file exists. */
  logo?: string;
}

/** What the mark shows for a bank name, known or not: "SBI" in SBI's blue, or initials in a quiet colour. */
export function bankMark(name: string | undefined): BankMarkInfo {
  const bank = findBank(name);
  if (bank) {
    let hash = 0;
    for (const ch of bank.name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return { text: bank.short, color: bank.color ?? FALLBACK_COLOURS[hash % FALLBACK_COLOURS.length], name: bank.name, logo: bank.logo ?? bank.ifsc?.toLowerCase() };
  }
  const clean = (name ?? '').replace(/\b(bank|ltd|limited|of|the|and|co-operative|cooperative)\b/gi, ' ').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const text = words.length > 1 ? words.slice(0, 3).map((w) => w[0]).join('') : (words[0] ?? '?').slice(0, 4);
  let hash = 0;
  for (const ch of name ?? '') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { text: text.toUpperCase(), color: FALLBACK_COLOURS[hash % FALLBACK_COLOURS.length] };
}

/**
 * The name to put before a paper: "SBI cancelled cheque", "HDFC passbook",
 * "Canara Bank statement", "Union Bank cheque". Initials when people say
 * the initials, the name otherwise.
 */
export function bankShortName(name: string): string {
  const bank = findBank(name);
  const full = (bank?.name ?? name).trim();
  if (bank && bank.short === bank.short.toUpperCase() && !fold(full).startsWith(fold(bank.short))) return bank.short;
  const trimmed = full.includes(' of ') ? full.replace(/\s+of India$/i, '') : full.replace(/\s+Bank$/i, '');
  const oneWord = !trimmed.includes(' ');
  // "Canara", "Axis" alone read oddly; "HDFC", "ICICI" do not.
  if (oneWord && trimmed !== trimmed.toUpperCase() && /\s+Bank$/i.test(full)) return `${trimmed} Bank`;
  return trimmed || full;
}
