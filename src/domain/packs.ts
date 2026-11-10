/**
 * Situation packs: one tap gathers what a moment needs (hospital, bank KYC,
 * school admission...) for one person, shows what is missing, and shares the
 * rest as one PDF. The moment of need is when people panic.
 */
import { canSee } from './access';
import type { IconName } from './icons';
import { getTemplate } from './templates';
import type { DocItem, Family, ID } from './types';

export interface PackItem {
  label: string;
  /** Any of these templates satisfies the item. */
  templateIds: string[];
  /** 'person': the chosen person's own paper. 'family': a common paper. 'either': whichever exists. */
  from: 'person' | 'family' | 'either';
  optional?: boolean;
}

export interface Pack {
  id: string;
  name: string;
  icon: IconName;
  line: string;
  items: PackItem[];
}

const ADDRESS_PROOF = ['aadhaar', 'voter-id', 'passport', 'driving-licence'];

export const PACKS: readonly Pack[] = [
  {
    id: 'hospital', name: 'Hospital admission', icon: 'Hospital', line: 'The desk asks for ID and the insurance card first.',
    items: [
      { label: 'Aadhaar (ID proof)', templateIds: ['aadhaar'], from: 'person' },
      { label: 'Health insurance card or policy', templateIds: ['health-insurance-card', 'cghs-echs-card', 'ayushman-card', 'family-floater'], from: 'either' },
      { label: 'Recent prescriptions or reports', templateIds: ['prescription', 'lab-report', 'discharge-summary'], from: 'person', optional: true },
    ],
  },
  {
    id: 'bank-kyc', name: 'Bank KYC', icon: 'Landmark', line: 'Opening an account, or the yearly re-KYC.',
    items: [
      { label: 'PAN card', templateIds: ['pan'], from: 'person' },
      { label: 'Aadhaar', templateIds: ['aadhaar'], from: 'person' },
      { label: 'Address proof', templateIds: ADDRESS_PROOF, from: 'person' },
      { label: 'Passport-size photo', templateIds: ['passport-photo'], from: 'person' },
      { label: 'Signature', templateIds: ['signature'], from: 'person', optional: true },
    ],
  },
  {
    id: 'school', name: 'School admission', icon: 'School', line: 'Birth certificate, ID and photos for the child.',
    items: [
      { label: 'Birth certificate', templateIds: ['birth-certificate'], from: 'person' },
      { label: 'Aadhaar', templateIds: ['aadhaar'], from: 'person' },
      { label: 'Passport-size photo', templateIds: ['passport-photo'], from: 'person' },
      { label: 'Transfer certificate (if changing school)', templateIds: ['school-leaving'], from: 'person', optional: true },
      { label: 'Category certificate, if any', templateIds: ['caste-certificate', 'ews-certificate', 'disability-certificate'], from: 'person', optional: true },
    ],
  },
  {
    id: 'exam', name: 'Exam form', icon: 'GraduationCap', line: 'Photo, signature and the Class 10 certificate.',
    items: [
      { label: 'Passport-size photo', templateIds: ['passport-photo'], from: 'person' },
      { label: 'Signature', templateIds: ['signature'], from: 'person' },
      { label: 'Class 10 certificate or marksheet', templateIds: ['class-10-certificate', 'class-10-marksheet'], from: 'person' },
      { label: 'Aadhaar', templateIds: ['aadhaar'], from: 'person' },
      { label: 'Class 12 marksheet', templateIds: ['class-12-marksheet', 'class-12-certificate'], from: 'person', optional: true },
      { label: 'Category certificate, if any', templateIds: ['caste-certificate', 'ews-certificate', 'disability-certificate'], from: 'person', optional: true },
    ],
  },
  {
    id: 'travel', name: 'Travel abroad', icon: 'Plane', line: 'Passport, visa and travel insurance in one file.',
    items: [
      { label: 'Passport', templateIds: ['passport'], from: 'person' },
      { label: 'Visa', templateIds: ['visa'], from: 'person', optional: true },
      { label: 'Travel insurance', templateIds: ['travel-insurance', 'family-travel-insurance'], from: 'either' },
      { label: 'Forex card', templateIds: ['forex-card'], from: 'person', optional: true },
    ],
  },
  {
    id: 'vehicle', name: 'Vehicle check', icon: 'Car', line: 'What a traffic stop or a service centre asks for.',
    items: [
      { label: 'Driving licence', templateIds: ['driving-licence'], from: 'person' },
      { label: 'Registration certificate (RC)', templateIds: ['rc'], from: 'family' },
      { label: 'Vehicle insurance', templateIds: ['vehicle-insurance'], from: 'family' },
      { label: 'Pollution certificate (PUC)', templateIds: ['puc'], from: 'family' },
    ],
  },
  {
    id: 'home-loan', name: 'Home loan', icon: 'House', line: 'Income, identity and the property papers.',
    items: [
      { label: 'PAN card', templateIds: ['pan'], from: 'person' },
      { label: 'Aadhaar', templateIds: ['aadhaar'], from: 'person' },
      { label: 'Salary slips', templateIds: ['salary-slip'], from: 'person' },
      { label: 'Form 16 or ITR', templateIds: ['form-16', 'itr'], from: 'person' },
      { label: 'Bank passbook or cancelled cheque', templateIds: ['passbook', 'cancelled-cheque'], from: 'person' },
      { label: 'Property papers', templateIds: ['sale-deed', 'allotment-letter', 'builder-buyer-agreement'], from: 'family' },
    ],
  },
];

export function getPack(id: string): Pack | undefined {
  return PACKS.find((p) => p.id === id);
}

export interface PackResult {
  item: PackItem;
  docs: DocItem[];
}

/** For one person: which papers fill each item (newest first), using only what the viewer can see. */
export function evaluatePack(pack: Pack, family: Family, viewerId: ID, personId: ID): { results: PackResult[]; missingRequired: number } {
  const results = pack.items.map((item) => {
    const docs = family.documents
      .filter((d) => item.templateIds.includes(d.templateId) && canSee(family, viewerId, d))
      .filter((d) => (item.from === 'person' ? d.ownerId === personId : item.from === 'family' ? !d.ownerId : d.ownerId === personId || !d.ownerId))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return { item, docs: docs.slice(0, 2) };
  });
  return { results, missingRequired: results.filter((r) => !r.item.optional && r.docs.length === 0).length };
}

/** The documents to put in the PDF, in pack order, without duplicates. */
export function packDocuments(results: PackResult[]): DocItem[] {
  const seen = new Set<ID>();
  const out: DocItem[] = [];
  for (const r of results) {
    const doc = r.docs[0];
    if (doc && !seen.has(doc.id)) {
      seen.add(doc.id);
      out.push(doc);
    }
  }
  return out;
}

export function packTemplateNames(pack: Pack): string[] {
  return pack.items.map((i) => getTemplate(i.templateIds[0]).name);
}
