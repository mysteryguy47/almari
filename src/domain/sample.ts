/**
 * "Explore a sample family": the Sharmas, built fresh each time with dates
 * relative to today, so there is always something expiring, due or overdue.
 *
 * Every number here is deliberately impossible, so the sample can never show
 * a real person's details:
 * - Aadhaar numbers start with 1 (real ones never start with 0 or 1).
 * - PANs have O as the 4th letter (not a valid holder type).
 * - Phone numbers start with 0 after +91 (Indian mobiles start with 6 to 9).
 * - Card numbers are the public test numbers card networks publish.
 * - Emails use example.com, which is reserved for examples.
 */
import { addDays, toISODate, ymdFromDate } from './dates';
import type {
  BankAccount, CardItem, Contact, DocItem, Family, FileRef, LoginItem, Member, SecureNote, Task,
} from './types';

export const SAMPLE_FAMILY_ID = 'sample-sharma';
export const SAMPLE_VIEWER_ID = 's-ananya';

export function buildSampleFamily(now: Date = new Date()): Family {
  const today = ymdFromDate(now);
  const inDays = (n: number) => toISODate(addDays(today, n));
  const at = (n: number, time: string) => `${inDays(n)}T${time}`;
  const t0 = now.getTime() - 40 * 86_400_000;
  /** A day of the month a few days from now, so the bill shows as due soon. */
  const dayIn = (n: number) => addDays(today, n).d;

  const m = (id: string, data: Omit<Member, 'id' | 'createdAt' | 'ids'> & { ids?: Member['ids'] }): Member => ({
    id, createdAt: t0, ids: {}, ...data,
  });
  const members: Member[] = [
    m('s-papa', {
      kind: 'account', email: 'rajesh.sharma@example.com', fullName: 'Rajesh Kumar Sharma', relation: 'Papa',
      gender: 'male', dob: '1966-05-02', phone: '+91 01234 56781', bloodGroup: 'B+', status: 'active',
      ids: { aadhaar: '1234 5678 9012', pan: 'DEMOR1001A', dl: 'XX0420110012345' },
      emergency: {
        allergies: 'Penicillin', conditions: 'Blood pressure', medicines: 'Telmisartan 40 mg, every morning',
        doctor: 'Dr. Mehta, +91 01234 56700', contacts: 'Sunita (wife), +91 01234 56782',
      },
    }),
    m('s-mummy', {
      kind: 'account', email: 'sunita.sharma@example.com', fullName: 'Sunita Sharma', relation: 'Mummy',
      gender: 'female', dob: '1970-08-15', phone: '+91 01234 56782', bloodGroup: 'O+', status: 'active',
      ids: { aadhaar: '1234 5678 9023', pan: 'DEMOS1002B' },
    }),
    m('s-ananya', {
      kind: 'account', email: 'ananya.sharma@example.com', fullName: 'Ananya Sharma', gender: 'female',
      dob: '2000-01-20', phone: '+91 01234 56783', bloodGroup: 'B+', status: 'active',
      ids: { aadhaar: '1234 5678 9034', pan: 'DEMOA1003C', passport: 'X0000001' },
    }),
    m('s-kabir', {
      kind: 'profile', fullName: 'Kabir Sharma', gender: 'male', dob: '2014-06-10', bloodGroup: 'B+', status: 'active',
      ids: { aadhaar: '1234 5678 9045' },
    }),
    m('s-dadi', {
      kind: 'profile', fullName: 'Kamla Devi', relation: 'Dadi', gender: 'female', dob: '1944', status: 'active',
      ids: { aadhaar: '1234 5678 9056' },
      emergency: { conditions: 'Diabetes', medicines: 'Metformin 500 mg, twice a day', doctor: 'Dr. Mehta, +91 01234 56700' },
    }),
    m('s-dadaji', {
      kind: 'profile', fullName: 'Hari Prasad Sharma', relation: 'Dadaji', gender: 'male', dob: '1938', status: 'memorial',
    }),
    m('s-bruno', { kind: 'profile', fullName: 'Bruno', relation: 'Bruno', dob: '2019', status: 'active', isPet: true }),
  ];

  let fileCount = 0;
  const file = (name: string, kb: number): FileRef => ({
    id: `s-file-${++fileCount}`, name, mime: name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg', size: kb * 1024, kind: 'sample',
  });
  const d = (id: string, data: Omit<DocItem, 'id' | 'createdAt' | 'updatedAt' | 'mutedBy' | 'onlyMe' | 'createdBy' | 'files'> &
    Partial<Pick<DocItem, 'onlyMe' | 'createdBy' | 'files'>>): DocItem => ({
    id, createdAt: t0, updatedAt: t0, mutedBy: [], onlyMe: false, createdBy: 's-ananya',
    files: [file(`${id}.jpg`, 380)], ...data,
  });

  const documents: DocItem[] = [
    d('s-d-aadhaar-papa', { templateId: 'aadhaar', title: "Papa's Aadhaar", scope: 'personal', ownerId: 's-papa', number: '1234 5678 9012', original: 'Steel almari, top shelf, red file', files: [file('aadhaar-front.jpg', 310), file('aadhaar-back.jpg', 290)] }),
    d('s-d-pan-papa', { templateId: 'pan', title: "Papa's PAN", scope: 'personal', ownerId: 's-papa', number: 'DEMOR1001A', original: "Papa's wallet" }),
    d('s-d-dl-papa', { templateId: 'driving-licence', title: "Papa's driving licence", scope: 'personal', ownerId: 's-papa', number: 'XX0420110012345', expiryDate: inDays(25), original: "Papa's wallet" }),
    d('s-d-aadhaar-mummy', { templateId: 'aadhaar', title: "Mummy's Aadhaar", scope: 'personal', ownerId: 's-mummy', number: '1234 5678 9023', original: 'Steel almari, top shelf, red file' }),
    d('s-d-pan-mummy', { templateId: 'pan', title: "Mummy's PAN", scope: 'personal', ownerId: 's-mummy', number: 'DEMOS1002B', original: 'Steel almari, top shelf, red file' }),
    d('s-d-fd-mummy', { templateId: 'fd-receipt', title: 'SBI fixed deposit', scope: 'personal', ownerId: 's-mummy', number: 'FD 000123', expiryDate: inDays(52), original: 'Steel almari, locker', nominee: 'Rajesh Kumar Sharma', files: [file('fd-receipt.pdf', 220)] }),
    d('s-d-lic-papa', { templateId: 'life-insurance', title: "Papa's LIC policy", scope: 'personal', ownerId: 's-papa', number: '000123456', expiryDate: inDays(70), original: 'Steel almari, top shelf, red file', nominee: 'Sunita Sharma', files: [file('lic-policy.pdf', 760)] }),
    d('s-d-mf-ananya', { templateId: 'mutual-fund', title: 'Mutual fund (SIP)', scope: 'personal', ownerId: 's-ananya', number: 'Folio 0000123/45', files: [file('mf-statement.pdf', 300)] }),
    d('s-d-thyroid-mummy', { templateId: 'lab-report', title: 'Thyroid report', scope: 'personal', ownerId: 's-mummy', createdBy: 's-mummy', onlyMe: true, issueDate: inDays(-20), files: [file('thyroid.pdf', 140)] }),
    d('s-d-aadhaar-ananya', { templateId: 'aadhaar', title: "Ananya's Aadhaar", scope: 'personal', ownerId: 's-ananya', number: '1234 5678 9034', original: 'Steel almari, top shelf, red file' }),
    d('s-d-pan-ananya', { templateId: 'pan', title: "Ananya's PAN", scope: 'personal', ownerId: 's-ananya', number: 'DEMOA1003C' }),
    d('s-d-passport-ananya', { templateId: 'passport', title: "Ananya's passport", scope: 'personal', ownerId: 's-ananya', number: 'X0000001', expiryDate: inDays(235), original: 'Steel almari, locker, blue folder' }),
    d('s-d-photo-ananya', { templateId: 'passport-photo', title: "Ananya's passport photo", scope: 'personal', ownerId: 's-ananya', files: [file('photo.jpg', 60)] }),
    d('s-d-degree-ananya', { templateId: 'degree', title: 'B.Com degree', scope: 'personal', ownerId: 's-ananya', original: 'Steel almari, locker, blue folder', files: [file('degree.pdf', 900)] }),
    d('s-d-aadhaar-kabir', { templateId: 'aadhaar', title: "Kabir's Aadhaar", scope: 'personal', ownerId: 's-kabir', number: '1234 5678 9045', createdBy: 's-mummy' }),
    d('s-d-birth-kabir', { templateId: 'birth-certificate', title: "Kabir's birth certificate", scope: 'personal', ownerId: 's-kabir', createdBy: 's-mummy', original: 'Steel almari, top shelf, red file' }),
    d('s-d-vaccine-kabir', { templateId: 'vaccination-card', title: "Kabir's vaccination card", scope: 'personal', ownerId: 's-kabir', createdBy: 's-mummy' }),
    d('s-d-aadhaar-dadi', { templateId: 'aadhaar', title: "Dadi's Aadhaar", scope: 'personal', ownerId: 's-dadi', number: '1234 5678 9056', original: "Dadi's trunk" }),
    d('s-d-ppo-dadi', { templateId: 'ppo', title: "Dadi's pension order", scope: 'personal', ownerId: 's-dadi', number: 'PPO 000000123', original: "Dadi's trunk", files: [file('ppo.pdf', 450)] }),
    d('s-d-bruno-vaccine', { templateId: 'pet-vaccination', title: "Bruno's vaccinations", scope: 'personal', ownerId: 's-bruno', expiryDate: inDays(64) }),
    d('s-d-rc', { templateId: 'rc', title: 'Car RC', scope: 'common', number: 'XX 01 AB 1234', original: 'Car glovebox', files: [file('rc-front.jpg', 300), file('rc-back.jpg', 280)] }),
    d('s-d-car-ins', { templateId: 'vehicle-insurance', title: 'Car insurance', scope: 'common', number: 'POL/0000/1234', expiryDate: inDays(12), original: 'Car glovebox', files: [file('car-insurance.pdf', 650)] }),
    d('s-d-puc', { templateId: 'puc', title: 'Car PUC', scope: 'common', expiryDate: inDays(-3), original: 'Car glovebox' }),
    d('s-d-deed', { templateId: 'sale-deed', title: 'House registry', scope: 'common', number: 'REG 0000/2009', issueDate: '2009-03-14', original: 'SBI bank locker 214', files: [file('sale-deed.pdf', 4200)] }),
    d('s-d-tax', { templateId: 'property-tax', title: 'Property tax receipt', scope: 'common', number: 'PID 000-0000', expiryDate: inDays(140), files: [file('tax-receipt.pdf', 180)] }),
    d('s-d-bijli', { templateId: 'electricity', title: 'Electricity connection', scope: 'common', number: 'CA 000123456789' }),
    d('s-d-lpg', { templateId: 'lpg', title: 'Gas passbook', scope: 'common', number: 'LPG ID 0000012345', original: 'Kitchen drawer' }),
    d('s-d-floater', { templateId: 'family-floater', title: 'Family health policy', scope: 'common', number: 'HLT/0000/5678', expiryDate: inDays(28), original: 'Steel almari, top shelf, red file', files: [file('health-policy.pdf', 1300)] }),
    d('s-d-fridge', { templateId: 'warranty-card', title: 'Fridge warranty', scope: 'common', number: 'SN 0000-1111', expiryDate: inDays(96), original: 'Kitchen drawer' }),
  ];

  const base = { createdAt: t0, updatedAt: t0, onlyMe: false, createdBy: 's-ananya' };
  const logins: LoginItem[] = [
    { ...base, id: 's-l-wifi', kind: 'wifi', title: 'Home Wi-Fi', username: 'Sharma_Home_5G', password: 'chai-aur-biscuit-42' },
    { ...base, id: 's-l-netflix', kind: 'login', title: 'Netflix', username: 'sharma.family@example.com', password: 'Sample#Pass1', website: 'netflix.com' },
    { ...base, id: 's-l-irctc', kind: 'login', title: 'IRCTC', ownerId: 's-papa', createdBy: 's-papa', username: 'rajesh66', password: 'Sample#Pass2', website: 'irctc.co.in' },
    { ...base, id: 's-l-itr', kind: 'login', title: 'Income Tax portal', ownerId: 's-papa', createdBy: 's-papa', username: 'DEMOR1001A', password: 'Sample#Pass3', website: 'incometax.gov.in' },
    { ...base, id: 's-l-mail', kind: 'login', title: 'My email', ownerId: 's-ananya', onlyMe: true, username: 'ananya.sharma@example.com', password: 'Sample#Pass4' },
  ];

  const bankAccounts: BankAccount[] = [
    { ...base, id: 's-b-papa-sbi', ownerId: 's-papa', createdBy: 's-papa', bank: 'State Bank of India', type: 'savings', accountNumber: '000012345678', ifsc: 'SBIN0001234', branch: 'Lajpat Nagar', nominee: 'Sunita Sharma', netbankingId: 'rajesh_s', netbankingPassword: 'Sample#Net1', registeredMobile: '+91 01234 56781', upiIds: 'rajesh@sbi' },
    { ...base, id: 's-b-papa-hdfc', ownerId: 's-papa', createdBy: 's-papa', bank: 'HDFC Bank', type: 'savings', accountNumber: '00001234567890', ifsc: 'HDFC0001234', nominee: 'Ananya Sharma' },
    { ...base, id: 's-b-mummy-pnb', ownerId: 's-mummy', createdBy: 's-mummy', bank: 'Punjab National Bank', type: 'savings', accountNumber: '0000123400012345', ifsc: 'PUNB0123400', nominee: 'Rajesh Kumar Sharma' },
    { ...base, id: 's-b-ananya-hdfc', ownerId: 's-ananya', bank: 'HDFC Bank', type: 'salary', accountNumber: '00009876543210', ifsc: 'HDFC0005678', netbankingId: 'ananya_s', netbankingPassword: 'Sample#Net2' },
  ];

  const c = (id: string, data: Omit<CardItem, 'id' | 'createdAt' | 'updatedAt' | 'onlyMe' | 'createdBy' | 'mutedBy'> & { createdBy?: string }): CardItem => ({
    ...base, mutedBy: [], id, ...data,
  });
  const cards: CardItem[] = [
    c('s-c-papa-sbi-debit', { type: 'debit', bank: 'State Bank of India', ownerId: 's-papa', createdBy: 's-papa', nameOnCard: 'RAJESH K SHARMA', number: '4111111111111111', network: 'visa', expiry: '08/29', linkedAccountId: 's-b-papa-sbi' }),
    c('s-c-papa-hdfc-credit', { type: 'credit', bank: 'HDFC Bank', nickname: 'Travel card', ownerId: 's-papa', createdBy: 's-papa', nameOnCard: 'RAJESH K SHARMA', number: '5555555555554444', network: 'mastercard', expiry: '03/28', creditLimit: 300000, statementDay: 18, dueDay: 7 }),
    c('s-c-ananya-hdfc-debit', { type: 'debit', bank: 'HDFC Bank', ownerId: 's-ananya', nameOnCard: 'ANANYA SHARMA', number: '4000056655665556', network: 'visa', expiry: '05/30', linkedAccountId: 's-b-ananya-hdfc' }),
    c('s-c-ananya-hdfc-credit', { type: 'credit', bank: 'HDFC Bank', nickname: 'Shopping card', ownerId: 's-ananya', nameOnCard: 'ANANYA SHARMA', number: '4012888888881881', network: 'visa', expiry: '12/27', creditLimit: 150000, statementDay: dayIn(-16), dueDay: dayIn(4) }),
    c('s-c-ananya-icici-credit', { type: 'credit', bank: 'ICICI Bank', nickname: 'Fuel card', ownerId: 's-ananya', nameOnCard: 'ANANYA SHARMA', number: '5105105105105100', network: 'mastercard', expiry: '09/28', creditLimit: 80000, statementDay: 20, dueDay: 8 }),
  ];

  const notes: SecureNote[] = [
    { ...base, id: 's-n-locker', title: 'Bank locker', body: 'SBI Lajpat Nagar, locker 214. Key: Mummy’s almari, red pouch. Nominee: Sunita.' },
    { ...base, id: 's-n-puk', title: 'SIM PUK codes', ownerId: 's-papa', createdBy: 's-papa', body: 'Papa’s SIM PUK: 00000000 (sample)' },
  ];

  const task = (id: string, data: Omit<Task, 'id' | 'createdAt' | 'createdBy' | 'repeat' | 'done' | 'assignees'> & Partial<Task>): Task => ({
    id, createdAt: t0, createdBy: 's-ananya', repeat: 'none', done: false, assignees: [], ...data,
  });
  const tasks: Task[] = [
    task('s-t-puc', { title: 'Get the car’s PUC done', dueAt: at(1, '10:00'), linkedDocId: 's-d-puc' }),
    task('s-t-insurance', { title: 'Renew car insurance', assignees: ['s-papa'], dueAt: at(9, '18:00'), linkedDocId: 's-d-car-ins', createdBy: 's-mummy' }),
    task('s-t-life-cert', { title: 'Submit Dadi’s life certificate', note: 'Jeevan Pramaan at the bank, or the doorstep service', assignees: ['s-ananya'], dueAt: at(20, '11:00'), linkedDocId: 's-d-ppo-dadi', repeat: 'yearly' }),
    task('s-t-tax', { title: 'Pay property tax', dueAt: at(45, '12:00'), linkedDocId: 's-d-tax', repeat: 'yearly' }),
    task('s-t-fees', { title: 'Kabir’s school fees', assignees: ['s-mummy'], dueAt: at(-6, '10:00'), done: true, doneAt: now.getTime() - 7 * 86_400_000, doneBy: 's-mummy', createdBy: 's-mummy' }),
  ];

  const contacts: Contact[] = [
    { id: 's-k-doctor', name: 'Dr. Mehta', role: 'Family doctor', phone: '+91 01234 56700', createdBy: 's-mummy', createdAt: t0 },
    { id: 's-k-ca', name: 'Gupta ji', role: 'CA', phone: '+91 01234 56701', createdBy: 's-papa', createdAt: t0 },
    { id: 's-k-gas', name: 'Gas agency', role: 'LPG booking', phone: '+91 01234 56702', createdBy: 's-mummy', createdAt: t0 },
    { id: 's-k-electrician', name: 'Ramesh', role: 'Electrician', phone: '+91 01234 56703', createdBy: 's-papa', createdAt: t0 },
  ];

  return {
    id: SAMPLE_FAMILY_ID,
    name: "Sharma's",
    createdAt: t0,
    createdBy: 'sample',
    personalSharing: 'family',
    members, documents, logins, bankAccounts, cards, notes, tasks, contacts,
    activity: [
      // Newest first, as the app keeps it.
      { id: 's-a-3', at: now.getTime() - 3_600_000, by: 's-ananya', kind: 'added', text: 'added the family health policy' },
      { id: 's-a-2', at: now.getTime() - 86_400_000, by: 's-mummy', kind: 'task', text: 'assigned Papa: Renew car insurance' },
      { id: 's-a-1', at: now.getTime() - 2 * 86_400_000, by: 's-mummy', kind: 'added', text: "added Kabir's vaccination card" },
    ],
    reminderPrefs: {},
    removalRequests: [],
    isSample: true,
  };
}
