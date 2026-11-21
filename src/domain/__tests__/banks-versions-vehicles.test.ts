/**
 * Banks by a few letters, one paper per person with its versions, family
 * vehicles, sharing a card, and bank accounts with several logins.
 */
import { bankFromIfsc, bankMark, bankShortName, BANKS, findBank, searchBanks } from '../banks';
import { bankCredentials, cleanCredentials, shareCardText } from '../money';
import { getTemplate, TEMPLATES } from '../templates';
import { MAIN_VERSION } from '../types';
import { docVersions, duplicateGroups, existingUnique, fileUsedElsewhere, freshLabel, mainFiles, versionFiles } from '../versions';
import {
  checkPlate, formatPlate, looseVehicleDocs, missingEssentials, normalisePlate, vehicleByPlate, vehicleDocTitle, vehicleDocs,
} from '../vehicles';
import { card, doc, family, NOW } from './factory';

describe('banks', () => {
  it('finds a bank from its first letters, its short name or an old name', () => {
    expect(searchBanks('sb')[0].name).toBe('State Bank of India');
    expect(searchBanks('hd')[0].name).toBe('HDFC Bank');
    expect(searchBanks('icici')[0].name).toBe('ICICI Bank');
    expect(searchBanks('kotak')[0].name).toBe('Kotak Mahindra Bank');
    expect(searchBanks('vijaya')[0].name).toBe('Bank of Baroda');
    expect(searchBanks('oriental')[0].name).toBe('Punjab National Bank');
    expect(searchBanks('aryavart')[0].name).toBe('Uttar Pradesh Gramin Bank');
    expect(searchBanks('maha').map((b) => b.name)).toContain('Bank of Maharashtra');
    expect(searchBanks('')).toEqual([]);
    expect(searchBanks('zzzz')).toEqual([]);
  });

  it('keeps card issuers out of account suggestions unless asked', () => {
    expect(searchBanks('amex').map((b) => b.name)).not.toContain('American Express');
    expect(searchBanks('amex', 6, true)[0].name).toBe('American Express');
  });

  it('knows a bank by its full name, short name or an older name', () => {
    expect(findBank('state bank of india')?.short).toBe('SBI');
    expect(findBank('SBI')?.name).toBe('State Bank of India');
    expect(findBank('Corporation Bank')?.name).toBe('Union Bank of India');
    expect(findBank('Punjab & Sind Bank')?.short).toBe('P&S');
    expect(findBank('Punjab and Sind Bank')?.short).toBe('P&S');
    expect(findBank('Sharma Sahakari')).toBeUndefined();
    expect(bankFromIfsc('ibkl0001234')?.name).toBe('IDBI Bank');
  });

  it('has no two banks with the same name or IFSC code', () => {
    const names = BANKS.map((b) => b.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    const codes = BANKS.filter((b) => b.ifsc).map((b) => b.ifsc);
    expect(new Set(codes).size).toBe(codes.length);
    expect(BANKS.length).toBeGreaterThan(100);
    for (const b of BANKS) expect(b.short.length).toBeLessThanOrEqual(6);
  });

  it('draws a mark for any name: known banks in their colour, others by initials', () => {
    expect(bankMark('HDFC Bank')).toMatchObject({ text: 'HDFC', name: 'HDFC Bank' });
    expect(bankMark('HDFC Bank').color).toMatch(/^#[0-9A-F]{6}$/i);
    expect(bankMark('Sharma Sahakari Bank').text).toBe('SS');
    expect(bankMark('Lakshmi').text).toBe('LAKS');
    expect(bankShortName('State Bank of India')).toBe('SBI');
    expect(bankShortName('HDFC Bank')).toBe('HDFC');
    expect(bankShortName('Punjab National Bank')).toBe('PNB');
    expect(bankShortName('Canara Bank')).toBe('Canara Bank');
    expect(bankShortName('Axis Bank')).toBe('Axis Bank');
    expect(bankShortName('Union Bank of India')).toBe('Union Bank');
    expect(bankShortName('Bank of India')).toBe('BOI');
    expect(bankShortName('Bank of Baroda')).toBe('Bank of Baroda');
    expect(bankShortName('Kotak Mahindra Bank')).toBe('Kotak Mahindra');
    expect(bankShortName('Gram Seva Bank')).toBe('Gram Seva');
  });
});

describe('one paper per person, with versions', () => {
  it('marks the papers a person has only one of', () => {
    for (const id of ['aadhaar', 'pan', 'voter-id', 'driving-licence', 'passport', 'birth-certificate', 'class-10-marksheet', 'rc']) {
      expect(getTemplate(id).unique).toBe(true);
    }
    for (const id of ['degree', 'prescription', 'salary-slip', 'purchase-bill', 'service-record', 'vehicle-insurance']) {
      expect(getTemplate(id).unique).toBeFalsy();
    }
    // Every profile number belongs to a one-per-person paper.
    for (const t of TEMPLATES.filter((x) => x.profileId)) expect(t.unique).toBe(true);
  });

  const aadhaar = doc('a1', { templateId: 'aadhaar', ownerId: 'papa', createdAt: 1, files: [
    { id: 'f1', name: 'front.jpg', mime: 'image/jpeg', size: 1, kind: 'image' },
    { id: 'f2', name: 'back.jpg', mime: 'image/jpeg', size: 1, kind: 'image' },
    { id: 'f3', name: 'masked.jpg', mime: 'image/jpeg', size: 1, kind: 'image', versionId: 'v-masked' },
  ], versions: [
    { id: MAIN_VERSION, label: 'Original', addedAt: 1, addedBy: 'ananya' },
    { id: 'v-masked', label: 'Masked', addedAt: 2, addedBy: 'ananya' },
  ] });

  it('lists versions and their pages', () => {
    expect(docVersions(doc('x')).map((v) => v.label)).toEqual(['Original']);
    expect(docVersions(aadhaar).map((v) => v.id)).toEqual([MAIN_VERSION, 'v-masked']);
    expect(versionFiles(aadhaar).map((f) => f.id)).toEqual(['f1', 'f2']);
    expect(versionFiles(aadhaar, 'v-masked').map((f) => f.id)).toEqual(['f3']);
    expect(mainFiles(aadhaar).map((f) => f.id)).toEqual(['f1', 'f2']);
  });

  it('never repeats a version name', () => {
    expect(freshLabel(aadhaar, 'PVC card')).toBe('PVC card');
    expect(freshLabel(aadhaar, 'masked')).toBe('masked 2');
    expect(freshLabel(aadhaar, '  ')).toBe('Copy');
  });

  it('finds the paper a new one would duplicate, for the same person only', () => {
    const f = family({ documents: [aadhaar, doc('pan', { templateId: 'pan', ownerId: 'papa' }), doc('deg', { templateId: 'degree', ownerId: 'papa' })] });
    expect(existingUnique(f, 'ananya', 'aadhaar', 'papa')?.id).toBe('a1');
    expect(existingUnique(f, 'ananya', 'aadhaar', 'mummy')).toBeUndefined();
    expect(existingUnique(f, 'ananya', 'aadhaar', 'papa', { exceptId: 'a1' })).toBeUndefined();
    expect(existingUnique(f, 'ananya', 'degree', 'papa')).toBeUndefined();
    // Deleted papers do not count.
    const gone = family({ documents: [{ ...aadhaar, deletedAt: 5 }] });
    expect(existingUnique(gone, 'ananya', 'aadhaar', 'papa')).toBeUndefined();
  });

  it('does not reveal a private paper of someone else as a duplicate', () => {
    const f = family({ documents: [{ ...aadhaar, ownerId: 'mummy', onlyMe: true, createdBy: 'mummy' }] });
    expect(existingUnique(f, 'ananya', 'aadhaar', 'mummy')).toBeUndefined();
    expect(existingUnique(f, 'mummy', 'aadhaar', 'mummy')?.id).toBe('a1');
  });

  it('groups papers saved twice before the rule, oldest first', () => {
    const f = family({ documents: [aadhaar, { ...aadhaar, id: 'a2', createdAt: 0 }, { ...aadhaar, id: 'a3', ownerId: 'mummy' }] });
    expect(duplicateGroups(f, 'ananya').map((g) => g.map((d) => d.id))).toEqual([['a2', 'a1']]);
  });

  it('treats an RC as one per vehicle', () => {
    const f = family({ documents: [doc('rc1', { templateId: 'rc', scope: 'common', vehicleId: 'car' })] });
    expect(existingUnique(f, 'ananya', 'rc', undefined, { vehicleId: 'car' })?.id).toBe('rc1');
    expect(existingUnique(f, 'ananya', 'rc', undefined, { vehicleId: 'scooter' })).toBeUndefined();
    expect(existingUnique(f, 'ananya', 'rc', undefined)).toBeUndefined();
  });

  it('knows when another paper still uses a file', () => {
    const f = family({ documents: [aadhaar, doc('other', { files: [{ id: 'f3', name: 'm.jpg', mime: 'image/jpeg', size: 1, kind: 'image' }] })] });
    expect(fileUsedElsewhere(f, 'f3', 'a1')).toBe(true);
    expect(fileUsedElsewhere(f, 'f1', 'a1')).toBe(false);
  });
});

describe('vehicles', () => {
  it('reads and prints number plates', () => {
    expect(normalisePlate('dl 3c ab-1234')).toBe('DL3CAB1234');
    expect(formatPlate('DL3CAB1234')).toBe('DL 3C AB 1234');
    expect(formatPlate('mh12de1433')).toBe('MH 12 DE 1433');
    expect(formatPlate('MH1DE1433')).toBe('MH 01 DE 1433');
    expect(formatPlate('DL8S1234')).toBe('DL 8S 1234');
    expect(formatPlate('22BH1234AA')).toBe('22 BH 1234 AA');
    expect(checkPlate('DL 3C AB 1234').level).toBe('ok');
    expect(checkPlate('22 BH 1234 AA').level).toBe('ok');
    expect(checkPlate('hello').level).toBe('warn');
    expect(checkPlate('').level).toBe('ok');
  });

  const vehicles = [
    { id: 'car', name: 'Swift', kind: 'car' as const, number: 'DL3CAB1234', onlyMe: false, createdBy: 'papa', createdAt: 0, updatedAt: 0 },
    { id: 'old', name: 'Maruti 800', kind: 'car' as const, onlyMe: false, createdBy: 'papa', createdAt: 0, updatedAt: 0, deletedAt: 1 },
  ];

  it('keeps each vehicle’s papers apart, and finds papers under none', () => {
    const f = family({
      vehicles,
      documents: [
        doc('ins', { templateId: 'vehicle-insurance', scope: 'common', vehicleId: 'car', expiryDate: '2026-11-20' }),
        doc('rc', { templateId: 'rc', scope: 'common', vehicleId: 'car' }),
        doc('puc-old', { templateId: 'puc', scope: 'common', vehicleId: 'old' }),
        doc('loose', { templateId: 'puc', scope: 'common' }),
        doc('pan', { templateId: 'pan', ownerId: 'papa' }),
      ],
    });
    expect(vehicleDocs(f, 'ananya', 'car').map((d) => d.id)).toEqual(['ins', 'rc']);
    // A deleted vehicle's papers count as under no vehicle.
    expect(looseVehicleDocs(f, 'ananya').map((d) => d.id).sort()).toEqual(['loose', 'puc-old']);
    expect(missingEssentials(vehicleDocs(f, 'ananya', 'car'))).toEqual(['puc']);
    // An electric car has no exhaust to test, so it is never asked for a PUC.
    expect(missingEssentials(vehicleDocs(f, 'ananya', 'car'), { electric: true })).toEqual([]);
    expect(missingEssentials([], { electric: true })).toEqual(['rc', 'vehicle-insurance']);
    expect(missingEssentials([], { electric: false })).toEqual(['rc', 'vehicle-insurance', 'puc']);
    expect(vehicleByPlate(f, 'dl 3c ab 1234')?.id).toBe('car');
    expect(vehicleByPlate(f, 'DL3C')).toBeUndefined();
  });

  it('names a vehicle’s papers after it', () => {
    expect(vehicleDocTitle({ name: 'Swift' }, 'rc')).toBe('Swift RC');
    expect(vehicleDocTitle({ name: 'Activa ' }, 'vehicle-insurance')).toBe('Activa insurance');
    expect(vehicleDocTitle({ name: 'Swift' }, 'service-record')).toBe('Swift service');
  });

  it('files the vehicle papers under the vehicle, the rest stay where they are', () => {
    for (const t of TEMPLATES.filter((x) => x.category === 'vehicles')) expect(t.perVehicle).toBe(true);
    expect(TEMPLATES.filter((x) => x.perVehicle).every((x) => x.category === 'vehicles')).toBe(true);
  });
});

describe('sharing a card', () => {
  const c = card('c1', { bank: 'HDFC Bank', nickname: 'Travel card', number: '5555555555554444', network: 'mastercard', expiry: '03/28', cvv: '123', pin: '4321', nameOnCard: 'RAJESH K SHARMA' });

  it('puts the bank on top and only what was picked', () => {
    expect(shareCardText(c, ['name', 'number', 'expiry'])).toBe(
      'HDFC Bank Travel card\nCredit card · Mastercard\nName on card: RAJESH K SHARMA\nCard number: 5555 5555 5555 4444\nValid till: 03/28',
    );
    expect(shareCardText(c, ['number', 'cvv'])).toBe('HDFC Bank Travel card\nCredit card · Mastercard\nCard number: 5555 5555 5555 4444\nCVV: 123');
  });

  it('never includes the PIN, and falls back to the holder’s name', () => {
    const text = shareCardText({ ...c, nameOnCard: undefined }, ['name', 'number', 'expiry', 'cvv'], 'Rajesh Kumar Sharma');
    expect(text).not.toContain('4321');
    expect(text).toContain('Name on card: Rajesh Kumar Sharma');
  });
});

describe('bank logins', () => {
  it('reads an account saved with one net-banking password', () => {
    const list = bankCredentials({ id: 'b1', netbankingId: 'rajesh_s', netbankingPassword: 'pw1' });
    expect(list).toEqual([{ id: 'b1-nb', label: 'Net banking', username: 'rajesh_s', secrets: [{ id: 'b1-pw', label: 'Login password', value: 'pw1' }] }]);
    expect(bankCredentials({ id: 'b2' })).toEqual([]);
  });

  it('prefers the new list, with several passwords under one user ID', () => {
    const credentials = [{ id: 'c', label: 'Net banking', username: 'u', secrets: [{ id: 's1', label: 'Login password', value: 'a' }, { id: 's2', label: 'Transaction password', value: 'b' }] }];
    expect(bankCredentials({ id: 'b', credentials, netbankingId: 'old' })).toBe(credentials);
  });

  it('drops empty rows before saving', () => {
    expect(cleanCredentials([
      { id: '1', label: 'Net banking', username: ' ', secrets: [{ id: 's', label: 'Login password', value: '' }] },
      { id: '2', label: ' ', username: 'yono_user', secrets: [{ id: 't', label: '', value: '0000' }, { id: 'u', label: 'Profile password', value: '' }] },
    ])).toEqual([{ id: '2', label: 'Login', username: 'yono_user', secrets: [{ id: 't', label: 'Password', value: '0000' }] }]);
  });
});

it('the factory date is still the 10th of November', () => {
  expect(NOW.getDate()).toBe(10);
});
