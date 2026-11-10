/**
 * The document catalogue: 16 categories and about 120 built-in templates.
 * Each template knows its icon, the shape of the paper, its number field,
 * whether it expires, which profile number it fills, and the words people
 * actually search with ("adhar", "gaadi", "bima").
 */
import type { IconName } from './icons';
import type { IdKind, Scope } from './types';

export type Tint = 'inland' | 'lifafa' | 'stamp' | 'haldi' | 'sindoor' | 'almari';

export type CategoryId =
  | 'identity' | 'photo' | 'certificates' | 'education' | 'work' | 'health' | 'money' | 'travel'
  | 'home' | 'vehicles' | 'utilities' | 'legal' | 'bills' | 'insurance' | 'business' | 'land'
  | 'other';

export interface Category {
  id: CategoryId;
  name: string;
  scope: Scope;
  icon: IconName;
  tint: Tint;
  synonyms: string[];
}

export const CATEGORIES: readonly Category[] = [
  { id: 'identity', name: 'Identity', scope: 'personal', icon: 'IdCard', tint: 'lifafa', synonyms: ['id', 'id proof', 'pehchaan', 'kyc'] },
  { id: 'photo', name: 'Photo and signature', scope: 'personal', icon: 'Camera', tint: 'lifafa', synonyms: ['photo', 'sign', 'signature', 'dastakhat'] },
  { id: 'certificates', name: 'Certificates', scope: 'personal', icon: 'Stamp', tint: 'stamp', synonyms: ['praman patra', 'certificate'] },
  { id: 'education', name: 'Education', scope: 'personal', icon: 'GraduationCap', tint: 'stamp', synonyms: ['school', 'college', 'padhai', 'marksheet'] },
  { id: 'work', name: 'Work and income', scope: 'personal', icon: 'Briefcase', tint: 'lifafa', synonyms: ['job', 'naukri', 'salary', 'office'] },
  { id: 'health', name: 'Health', scope: 'personal', icon: 'HeartPulse', tint: 'sindoor', synonyms: ['medical', 'hospital', 'doctor', 'dawai', 'mediclaim'] },
  { id: 'money', name: 'Money', scope: 'personal', icon: 'PiggyBank', tint: 'haldi', synonyms: ['bank', 'paisa', 'investment', 'bachat', 'savings'] },
  { id: 'travel', name: 'Travel', scope: 'personal', icon: 'Plane', tint: 'inland', synonyms: ['abroad', 'videsh', 'trip', 'yatra'] },
  { id: 'home', name: 'Home and property', scope: 'common', icon: 'House', tint: 'inland', synonyms: ['ghar', 'makaan', 'flat', 'property', 'plot'] },
  { id: 'vehicles', name: 'Vehicles', scope: 'common', icon: 'Car', tint: 'inland', synonyms: ['gaadi', 'gadi', 'car', 'scooter', 'bike', 'motor'] },
  { id: 'utilities', name: 'Utilities', scope: 'common', icon: 'Zap', tint: 'haldi', synonyms: ['bijli', 'light bill', 'pani', 'gas', 'connection'] },
  { id: 'legal', name: 'Family and legal', scope: 'common', icon: 'Scale', tint: 'stamp', synonyms: ['kanooni', 'court', 'vasiyat', 'legal'] },
  { id: 'bills', name: 'Bills and warranty', scope: 'common', icon: 'Receipt', tint: 'almari', synonyms: ['bill', 'guarantee', 'warranty', 'raseed'] },
  { id: 'insurance', name: 'Family insurance', scope: 'common', icon: 'Umbrella', tint: 'sindoor', synonyms: ['bima', 'insurance', 'policy', 'mediclaim'] },
  { id: 'business', name: 'Family business', scope: 'common', icon: 'Store', tint: 'almari', synonyms: ['dukaan', 'shop', 'firm', 'karobar', 'gst'] },
  { id: 'land', name: 'Land and farming', scope: 'common', icon: 'Wheat', tint: 'almari', synonyms: ['zameen', 'kheti', 'khet', 'farm', 'jamabandi'] },
];

export type NumberKind = IdKind | 'ifsc' | 'vehicle' | 'generic';
export type Shape = 'card' | 'a4' | 'photo';

export interface ReminderRule {
  /** Remind this many days before. */
  days?: number[];
  /** Or this many months before (passports, for visa rules). */
  months?: number[];
}

export const DEFAULT_REMINDER: ReminderRule = { days: [30, 7, 1] };

export interface Template {
  id: string;
  name: string;
  category: CategoryId;
  icon: IconName;
  shape: Shape;
  sides?: 2;
  number?: { label: string; kind?: NumberKind };
  /** Present when the paper expires or renews; the label names the date. */
  expiry?: { label: string; rule?: ReminderRule };
  issueDate?: boolean;
  /** The profile ID number this document fills. */
  profileId?: IdKind;
  /** Has a nominee worth recording (deposits, policies, investments). */
  nominee?: boolean;
  synonyms?: string[];
}

const t = (
  id: string,
  name: string,
  category: CategoryId,
  icon: IconName,
  shape: Shape,
  extra: Omit<Template, 'id' | 'name' | 'category' | 'icon' | 'shape'> = {},
): Template => ({ id, name, category, icon, shape, ...extra });

const VALID_TILL = { label: 'Valid till' };
const RENEWAL = { label: 'Renewal due' };

export const TEMPLATES: readonly Template[] = [
  // ------------------------------------------------ Identity
  t('aadhaar', 'Aadhaar', 'identity', 'FingerprintPattern', 'card', {
    sides: 2, number: { label: 'Aadhaar number', kind: 'aadhaar' }, profileId: 'aadhaar',
    synonyms: ['adhar', 'aadhar', 'adhaar', 'uid', 'uidai', 'e-aadhaar', 'aadhaar card'],
  }),
  t('pan', 'PAN card', 'identity', 'IdCard', 'card', {
    number: { label: 'PAN', kind: 'pan' }, profileId: 'pan', synonyms: ['pan', 'pen card', 'pancard', 'income tax card'],
  }),
  t('voter-id', 'Voter ID', 'identity', 'IdCard', 'card', {
    sides: 2, number: { label: 'EPIC number', kind: 'voter' }, profileId: 'voter',
    synonyms: ['epic', 'election card', 'voter card', 'chunav'],
  }),
  t('driving-licence', 'Driving licence', 'identity', 'Car', 'card', {
    sides: 2, number: { label: 'Licence number', kind: 'dl' }, profileId: 'dl', expiry: VALID_TILL, issueDate: true,
    synonyms: ['dl', 'license', 'licence', 'driving license'],
  }),
  t('passport', 'Passport', 'identity', 'BookOpen', 'card', {
    number: { label: 'Passport number', kind: 'passport' }, profileId: 'passport', issueDate: true,
    expiry: { label: 'Valid till', rule: { months: [9, 3] } }, synonyms: ['passport'],
  }),
  t('birth-certificate', 'Birth certificate', 'identity', 'Baby', 'a4', {
    number: { label: 'Registration number' }, synonyms: ['janam praman patra', 'dob certificate'],
  }),
  t('oci-card', 'OCI card', 'identity', 'Globe', 'a4', { number: { label: 'OCI number' }, synonyms: ['overseas citizen'] }),

  // ------------------------------------------------ Photo and signature
  t('passport-photo', 'Passport-size photo', 'photo', 'Camera', 'photo', { synonyms: ['photo', 'pp photo', 'tasveer'] }),
  t('stamp-photo', 'Stamp-size photo', 'photo', 'Image', 'photo', { synonyms: ['small photo'] }),
  t('signature', 'Signature', 'photo', 'Signature', 'photo', { synonyms: ['sign', 'dastakhat', 'hastakshar'] }),

  // ------------------------------------------------ Certificates
  t('caste-certificate', 'Caste certificate', 'certificates', 'Stamp', 'a4', { number: { label: 'Certificate number' }, issueDate: true, synonyms: ['sc', 'st', 'obc', 'jati'] }),
  t('income-certificate', 'Income certificate', 'certificates', 'Stamp', 'a4', { number: { label: 'Certificate number' }, issueDate: true, expiry: VALID_TILL, synonyms: ['aay praman patra'] }),
  t('ews-certificate', 'EWS certificate', 'certificates', 'Stamp', 'a4', { number: { label: 'Certificate number' }, issueDate: true, expiry: VALID_TILL }),
  t('domicile-certificate', 'Domicile certificate', 'certificates', 'Stamp', 'a4', { number: { label: 'Certificate number' }, issueDate: true, synonyms: ['niwas praman patra', 'residence certificate'] }),
  t('disability-certificate', 'Disability certificate (UDID)', 'certificates', 'Stamp', 'card', { number: { label: 'UDID number' }, expiry: VALID_TILL }),
  t('name-change-gazette', 'Name-change gazette', 'certificates', 'Newspaper', 'a4', { issueDate: true, synonyms: ['gazette'] }),
  t('marriage-certificate', 'Marriage certificate', 'certificates', 'Heart', 'a4', { number: { label: 'Registration number' }, issueDate: true, synonyms: ['shaadi', 'vivah'] }),

  // ------------------------------------------------ Education
  t('class-10-marksheet', 'Class 10 marksheet', 'education', 'GraduationCap', 'a4', { number: { label: 'Roll number' }, synonyms: ['10th', 'matric', 'high school'] }),
  t('class-10-certificate', 'Class 10 certificate', 'education', 'Award', 'a4', { number: { label: 'Roll number' }, synonyms: ['10th certificate'] }),
  t('class-12-marksheet', 'Class 12 marksheet', 'education', 'GraduationCap', 'a4', { number: { label: 'Roll number' }, synonyms: ['12th', 'intermediate', 'senior secondary'] }),
  t('class-12-certificate', 'Class 12 certificate', 'education', 'Award', 'a4', { number: { label: 'Roll number' }, synonyms: ['12th certificate'] }),
  t('degree', 'Degree', 'education', 'Award', 'a4', { number: { label: 'Enrolment number' }, synonyms: ['graduation', 'convocation'] }),
  t('provisional-certificate', 'Provisional certificate', 'education', 'FileText', 'a4', { synonyms: ['provisional degree'] }),
  t('consolidated-marksheet', 'Consolidated marksheet', 'education', 'FileText', 'a4', {}),
  t('migration-certificate', 'Migration certificate', 'education', 'FileText', 'a4', {}),
  t('school-leaving', 'Transfer or school-leaving certificate', 'education', 'School', 'a4', { synonyms: ['tc', 'slc', 'leaving certificate'] }),
  t('character-certificate', 'Character certificate', 'education', 'FileCheck', 'a4', {}),
  t('entrance-scorecard', 'Entrance exam scorecard', 'education', 'Ticket', 'a4', { number: { label: 'Roll number' }, synonyms: ['jee', 'neet', 'cuet', 'admit card', 'result'] }),
  t('apaar-id', 'APAAR / ABC ID', 'education', 'IdCard', 'card', { number: { label: 'APAAR ID' }, synonyms: ['abc id', 'one nation one student'] }),

  // ------------------------------------------------ Work and income
  t('offer-letter', 'Offer letter', 'work', 'Mail', 'a4', {}),
  t('appointment-letter', 'Appointment letter', 'work', 'Mail', 'a4', {}),
  t('relieving-letter', 'Relieving letter', 'work', 'Mail', 'a4', {}),
  t('experience-letter', 'Experience letter', 'work', 'Mail', 'a4', {}),
  t('salary-slip', 'Salary slip', 'work', 'IndianRupee', 'a4', { synonyms: ['payslip', 'pay slip', 'tankhwah'] }),
  t('form-16', 'Form 16', 'work', 'FileText', 'a4', { synonyms: ['tds'] }),
  t('pf-passbook', 'PF passbook', 'work', 'PiggyBank', 'a4', { nominee: true, number: { label: 'UAN' }, synonyms: ['epf', 'uan', 'provident fund'] }),
  t('esic-card', 'ESIC card', 'work', 'IdCard', 'card', { number: { label: 'Insurance number' } }),
  t('ppo', 'Pension Payment Order (PPO)', 'work', 'Landmark', 'a4', { number: { label: 'PPO number' }, synonyms: ['pension', 'ppo'] }),
  t('professional-registration', 'Professional registration', 'work', 'Award', 'card', { number: { label: 'Registration number' }, expiry: VALID_TILL, synonyms: ['bar council', 'icai', 'medical council'] }),

  // ------------------------------------------------ Health
  t('health-insurance-card', 'Health insurance card', 'health', 'ShieldCheck', 'card', {
    number: { label: 'Policy number' }, expiry: RENEWAL, synonyms: ['mediclaim', 'tpa card', 'cashless card', 'bima'],
  }),
  t('abha', 'ABHA card', 'health', 'IdCard', 'card', { number: { label: 'ABHA number' }, synonyms: ['health id', 'ayushman bharat health account'] }),
  t('ayushman-card', 'Ayushman Bharat card', 'health', 'IdCard', 'card', { number: { label: 'Card number' }, synonyms: ['pmjay', 'golden card'] }),
  t('cghs-echs-card', 'CGHS or ECHS card', 'health', 'IdCard', 'card', { number: { label: 'Card number' }, expiry: VALID_TILL }),
  t('prescription', 'Prescription', 'health', 'Pill', 'a4', { issueDate: true, synonyms: ['parcha', 'dawai'] }),
  t('lab-report', 'Lab report', 'health', 'TestTube', 'a4', { issueDate: true, synonyms: ['blood test', 'report', 'jaanch'] }),
  t('discharge-summary', 'Discharge summary', 'health', 'Hospital', 'a4', { issueDate: true }),
  t('vaccination-card', 'Vaccination card', 'health', 'Syringe', 'a4', { synonyms: ['tika', 'teeka', 'immunisation'] }),
  t('spectacle-power', 'Spectacle power', 'health', 'Glasses', 'a4', { issueDate: true, synonyms: ['chashma', 'eye power', 'glasses'] }),
  t('pet-vaccination', 'Pet vaccination record', 'health', 'PawPrint', 'a4', { expiry: { label: 'Next dose due' }, synonyms: ['dog', 'cat', 'vet'] }),

  // ------------------------------------------------ Money
  t('passbook', 'Passbook first page', 'money', 'BookOpen', 'a4', { number: { label: 'Account number' }, synonyms: ['bank passbook'] }),
  t('cancelled-cheque', 'Cancelled cheque', 'money', 'Banknote', 'a4', { number: { label: 'Account number' }, synonyms: ['cheque'] }),
  t('fd-receipt', 'Fixed deposit receipt', 'money', 'PiggyBank', 'a4', { nominee: true, number: { label: 'FD number' }, expiry: { label: 'Matures on' }, synonyms: ['fd', 'fixed deposit'] }),
  t('ppf-passbook', 'PPF passbook', 'money', 'BookOpen', 'a4', { nominee: true, number: { label: 'PPF account number' }, expiry: { label: 'Matures on' } }),
  t('sukanya-passbook', 'Sukanya Samriddhi passbook', 'money', 'BookOpen', 'a4', { nominee: true, number: { label: 'Account number' }, synonyms: ['ssy'] }),
  t('post-office-passbook', 'Post-office passbook', 'money', 'BookOpen', 'a4', { nominee: true, number: { label: 'Account number' }, synonyms: ['dak ghar', 'kvp', 'nsc', 'rd'] }),
  t('nps', 'NPS (PRAN card)', 'money', 'IdCard', 'card', { nominee: true, number: { label: 'PRAN' }, synonyms: ['pran', 'pension'] }),
  t('demat', 'Demat account statement', 'money', 'TrendingUp', 'a4', { nominee: true, number: { label: 'Demat ID' }, synonyms: ['shares', 'stocks', 'dp id'] }),
  t('mutual-fund', 'Mutual fund statement', 'money', 'ChartPie', 'a4', { nominee: true, number: { label: 'Folio number' }, synonyms: ['mf', 'sip', 'folio'] }),
  t('life-insurance', 'Life insurance policy', 'money', 'Umbrella', 'a4', { nominee: true, number: { label: 'Policy number' }, expiry: { label: 'Next premium due' }, synonyms: ['lic', 'term plan', 'jeevan bima', 'bima'] }),
  t('loan-papers', 'Loan papers', 'money', 'HandCoins', 'a4', { number: { label: 'Loan account number' }, expiry: { label: 'Loan ends' }, synonyms: ['emi', 'karza'] }),
  t('itr', 'ITR acknowledgement', 'money', 'ReceiptText', 'a4', { number: { label: 'Acknowledgement number' }, synonyms: ['income tax return', 'itr v'] }),

  // ------------------------------------------------ Travel
  t('visa', 'Visa', 'travel', 'Stamp', 'a4', { number: { label: 'Visa number' }, expiry: VALID_TILL }),
  t('frequent-flyer', 'Frequent-flyer card', 'travel', 'Plane', 'card', { number: { label: 'Membership number' } }),
  t('forex-card', 'Forex card', 'travel', 'CreditCard', 'card', { expiry: VALID_TILL }),
  t('travel-insurance', 'Travel insurance', 'travel', 'Umbrella', 'a4', { number: { label: 'Policy number' }, expiry: VALID_TILL }),
  t('idp', 'International driving permit', 'travel', 'Car', 'a4', { number: { label: 'Permit number' }, expiry: VALID_TILL, synonyms: ['idp'] }),

  // ------------------------------------------------ Home and property
  t('sale-deed', 'Sale deed / registry', 'home', 'ScrollText', 'a4', { number: { label: 'Registration number' }, issueDate: true, synonyms: ['registry', 'rajistri', 'conveyance deed', 'bainama'] }),
  t('allotment-letter', 'Allotment letter', 'home', 'Mail', 'a4', {}),
  t('builder-buyer-agreement', 'Builder-buyer agreement', 'home', 'Handshake', 'a4', { synonyms: ['bba', 'agreement to sell'] }),
  t('possession-letter', 'Possession letter', 'home', 'KeyRound', 'a4', {}),
  t('occupancy-certificate', 'Occupancy certificate', 'home', 'FileCheck', 'a4', { synonyms: ['oc', 'completion certificate'] }),
  t('mutation', 'Mutation or khata', 'home', 'ScrollText', 'a4', { synonyms: ['dakhil kharij', 'khata', 'namantaran'] }),
  t('property-tax', 'Property tax receipt', 'home', 'ReceiptText', 'a4', { number: { label: 'Property ID' }, expiry: { label: 'Next tax due' }, synonyms: ['house tax', 'ghar tax'] }),
  t('encumbrance-certificate', 'Encumbrance certificate', 'home', 'FileCheck', 'a4', { synonyms: ['ec'] }),
  t('society-share-certificate', 'Society share certificate', 'home', 'Building', 'a4', {}),
  t('rent-agreement', 'Rent agreement', 'home', 'Handshake', 'a4', { expiry: { label: 'Agreement ends' }, synonyms: ['kirayanama', 'lease', 'rent'] }),
  t('tenant-verification', 'Tenant police verification', 'home', 'ShieldCheck', 'a4', { issueDate: true }),
  t('home-loan', 'Home loan papers', 'home', 'HandCoins', 'a4', { number: { label: 'Loan account number' }, expiry: { label: 'Loan ends' } }),
  t('home-insurance', 'Home insurance', 'home', 'Umbrella', 'a4', { number: { label: 'Policy number' }, expiry: RENEWAL, synonyms: ['bima'] }),

  // ------------------------------------------------ Vehicles
  t('rc', 'Registration certificate (RC)', 'vehicles', 'Car', 'card', {
    sides: 2, number: { label: 'Registration number', kind: 'vehicle' }, expiry: { label: 'Registration valid till' },
    synonyms: ['rc', 'gaadi ke kaagaz', 'registration'],
  }),
  t('vehicle-insurance', 'Vehicle insurance', 'vehicles', 'ShieldCheck', 'a4', { number: { label: 'Policy number' }, expiry: RENEWAL, synonyms: ['gaadi bima', 'car insurance', 'bike insurance'] }),
  t('puc', 'Pollution certificate (PUC)', 'vehicles', 'Gauge', 'a4', { number: { label: 'Certificate number' }, expiry: VALID_TILL, synonyms: ['puc', 'pollution'] }),
  t('fastag', 'FASTag', 'vehicles', 'Ticket', 'card', { number: { label: 'FASTag ID' } }),
  t('vehicle-invoice', 'Purchase invoice', 'vehicles', 'Receipt', 'a4', {}),
  t('loan-noc', 'Loan NOC', 'vehicles', 'FileCheck', 'a4', { synonyms: ['noc', 'hypothecation'] }),
  t('service-record', 'Service record', 'vehicles', 'Wrench', 'a4', { expiry: { label: 'Next service' } }),
  t('challan', 'Challan', 'vehicles', 'ReceiptText', 'a4', { number: { label: 'Challan number' } }),

  // ------------------------------------------------ Utilities
  t('electricity', 'Electricity bill', 'utilities', 'Zap', 'a4', { number: { label: 'Consumer / CA number' }, synonyms: ['bijli', 'light bill', 'ca number'] }),
  t('water', 'Water bill', 'utilities', 'Droplet', 'a4', { number: { label: 'Connection number' }, synonyms: ['pani'] }),
  t('piped-gas', 'Piped gas bill', 'utilities', 'Flame', 'a4', { number: { label: 'BP / customer number' }, synonyms: ['png', 'gas'] }),
  t('lpg', 'LPG connection and gas passbook', 'utilities', 'Flame', 'a4', { number: { label: 'LPG ID' }, synonyms: ['cylinder', 'gas passbook', 'gas book'] }),
  t('broadband', 'Broadband and router', 'utilities', 'Router', 'a4', { number: { label: 'Account number' }, synonyms: ['wifi', 'internet'] }),
  t('dth', 'DTH connection', 'utilities', 'Tv', 'a4', { number: { label: 'Subscriber ID' }, synonyms: ['tv', 'dish'] }),
  t('postpaid-mobile', 'Postpaid mobile', 'utilities', 'Smartphone', 'a4', { number: { label: 'Account number' } }),

  // ------------------------------------------------ Family and legal
  t('ration-card', 'Ration card', 'legal', 'BookOpen', 'a4', { number: { label: 'Ration card number' }, synonyms: ['nfsa', 'bpl', 'apl'] }),
  t('will', 'Will', 'legal', 'ScrollText', 'a4', { issueDate: true, synonyms: ['vasiyat', 'wasiyat'] }),
  t('power-of-attorney', 'Power of attorney', 'legal', 'Gavel', 'a4', { issueDate: true, synonyms: ['poa', 'mukhtarnama'] }),
  t('legal-heir-certificate', 'Legal-heir certificate', 'legal', 'Stamp', 'a4', {}),
  t('succession-certificate', 'Succession certificate', 'legal', 'Stamp', 'a4', {}),
  t('death-certificate', 'Death certificate', 'legal', 'Flower2', 'a4', { number: { label: 'Registration number' } }),
  t('gift-deed', 'Gift deed', 'legal', 'Gift', 'a4', { issueDate: true }),
  t('affidavit', 'Affidavit', 'legal', 'Stamp', 'a4', { issueDate: true, synonyms: ['halafnama'] }),
  t('court-papers', 'Court papers', 'legal', 'Gavel', 'a4', { number: { label: 'Case number' }, expiry: { label: 'Next hearing' } }),
  t('huf', 'HUF papers', 'legal', 'Users', 'a4', { number: { label: 'HUF PAN' } }),

  // ------------------------------------------------ Bills and warranty
  t('purchase-bill', 'Purchase bill', 'bills', 'Receipt', 'a4', { synonyms: ['invoice', 'raseed', 'pakka bill'] }),
  t('warranty-card', 'Warranty card', 'bills', 'ShieldCheck', 'a4', { number: { label: 'Serial number' }, expiry: { label: 'Warranty ends' }, synonyms: ['guarantee'] }),
  t('amc', 'AMC (RO, AC and others)', 'bills', 'Wrench', 'a4', { number: { label: 'Contract number' }, expiry: { label: 'AMC ends' }, synonyms: ['ro', 'service contract'] }),

  // ------------------------------------------------ Family insurance
  t('family-floater', 'Family-floater health policy', 'insurance', 'HeartHandshake', 'a4', { number: { label: 'Policy number' }, expiry: RENEWAL, synonyms: ['mediclaim', 'health insurance', 'bima'] }),
  t('family-travel-insurance', 'Family travel insurance', 'insurance', 'Umbrella', 'a4', { number: { label: 'Policy number' }, expiry: VALID_TILL }),

  // ------------------------------------------------ Family business
  t('gst', 'GST certificate', 'business', 'ReceiptText', 'a4', { number: { label: 'GSTIN' }, synonyms: ['gstin'] }),
  t('udyam', 'Udyam registration', 'business', 'Factory', 'a4', { number: { label: 'Udyam number' }, synonyms: ['msme', 'udyog aadhaar'] }),
  t('shop-licence', 'Shop and establishment licence', 'business', 'Store', 'a4', { number: { label: 'Licence number' }, expiry: VALID_TILL }),
  t('trade-licence', 'Trade licence', 'business', 'Store', 'a4', { number: { label: 'Licence number' }, expiry: VALID_TILL }),
  t('fssai', 'FSSAI licence', 'business', 'Package', 'a4', { number: { label: 'FSSAI number' }, expiry: VALID_TILL }),
  t('current-account', 'Current account papers', 'business', 'Landmark', 'a4', { number: { label: 'Account number' } }),
  t('partnership-deed', 'Partnership deed', 'business', 'Handshake', 'a4', { issueDate: true }),
  t('iec', 'Import Export Code (IEC)', 'business', 'Globe', 'a4', { number: { label: 'IEC' } }),

  // ------------------------------------------------ Land and farming
  t('land-record', 'Land record (khasra, khatauni, 7/12)', 'land', 'MapPin', 'a4', { number: { label: 'Khasra / survey number' }, synonyms: ['jamabandi', 'fard', 'patta', 'satbara', '7/12', 'khatauni'] }),
  t('kisan-credit-card', 'Kisan Credit Card', 'land', 'CreditCard', 'card', { expiry: RENEWAL, synonyms: ['kcc'] }),
  t('pm-kisan', 'PM-Kisan registration', 'land', 'Sprout', 'a4', { number: { label: 'Registration number' } }),
  t('soil-health-card', 'Soil health card', 'land', 'Leaf', 'a4', {}),
];

/** "Something else": a title and a file, nothing is unfileable. */
export const CUSTOM_TEMPLATE: Template = {
  id: 'custom',
  name: 'Something else',
  category: 'other',
  icon: 'FileText',
  shape: 'a4',
  number: { label: 'Number (optional)' },
  expiry: { label: 'Expiry date (optional)' },
};

const BY_ID = new Map<string, Template>([...TEMPLATES, CUSTOM_TEMPLATE].map((tpl) => [tpl.id, tpl]));
const CATEGORY_BY_ID = new Map<string, Category>(CATEGORIES.map((c) => [c.id, c]));

export const OTHER_CATEGORY: Category = {
  id: 'other', name: 'Other', scope: 'personal', icon: 'Folder', tint: 'almari', synonyms: [],
};

export function getTemplate(id: string): Template {
  return BY_ID.get(id) ?? CUSTOM_TEMPLATE;
}

/** First words that are names, so they keep their capital mid-sentence. */
const PROPER_FIRST_WORDS = new Set(['Aadhaar', 'Ayushman', 'Sukanya', 'Udyam', 'Kisan', 'Form', 'Pension', 'Import']);

/**
 * A template name as it reads after "My" or "Mummy’s": "driving licence",
 * "passport-size photo", but "Aadhaar", "PAN card" and "Form 16" unchanged.
 */
export function nameInSentence(name: string): string {
  const first = name.split(/[\s/]/)[0] ?? '';
  if (!first || PROPER_FIRST_WORDS.has(first) || /[A-Z]/.test(first.slice(1))) return name;
  return name.charAt(0).toLowerCase() + name.slice(1);
}

export function getCategory(id: string): Category {
  return CATEGORY_BY_ID.get(id) ?? OTHER_CATEGORY;
}

export function templatesIn(category: CategoryId): Template[] {
  return TEMPLATES.filter((tpl) => tpl.category === category);
}

export function scopeOfTemplate(template: Template): Scope {
  return template.id === 'custom' ? 'personal' : getCategory(template.category).scope;
}

export const PERSONAL_CATEGORIES = CATEGORIES.filter((c) => c.scope === 'personal');
export const COMMON_CATEGORIES = CATEGORIES.filter((c) => c.scope === 'common');

/** The template that fills a profile number, e.g. 'pan' -> PAN card. */
export function templateForIdKind(kind: IdKind): Template {
  const found = TEMPLATES.find((tpl) => tpl.profileId === kind);
  if (!found) throw new Error(`No template fills ${kind}`);
  return found;
}
