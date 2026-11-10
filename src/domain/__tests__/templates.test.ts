import { nameInSentence, TEMPLATES } from '../templates';

describe('nameInSentence', () => {
  it('lowercases ordinary first words so "My driving licence" reads right', () => {
    expect(nameInSentence('Driving licence')).toBe('driving licence');
    expect(nameInSentence('Passport-size photo')).toBe('passport-size photo');
    expect(nameInSentence('Will')).toBe('will');
    expect(nameInSentence('Sale deed / registry')).toBe('sale deed / registry');
  });

  it('keeps names and acronyms as they are', () => {
    for (const name of ['Aadhaar', 'PAN card', 'OCI card', 'FASTag', 'PM-Kisan registration', 'Form 16', 'Ayushman Bharat card', 'Sukanya Samriddhi passbook', 'Udyam registration', 'Kisan Credit Card', 'APAAR / ABC ID', 'Pension Payment Order (PPO)', 'Import Export Code (IEC)']) {
      expect(nameInSentence(name)).toBe(name);
    }
  });

  it('never changes anything but the first letter', () => {
    for (const t of TEMPLATES) {
      const out = nameInSentence(t.name);
      expect(out.slice(1)).toBe(t.name.slice(1));
      expect(out.toLowerCase()).toBe(t.name.toLowerCase());
    }
  });
});
