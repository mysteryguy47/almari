import {
  checkAadhaar, checkCardExpiry, checkCardNumber, checkDocDescription, checkDocTitle, checkEmail, checkFile,
  checkIfsc, checkNewPassword, checkPan, checkPassport, checkPhone, checkTaskTitle, charLength, fileKindOf,
  formatAadhaar, LIMITS, luhnValid, verhoeffCheckDigit, verhoeffValid,
} from '../validation';

describe('Verhoeff (Aadhaar check digit)', () => {
  it('accepts the textbook example 2363 and rejects 2364', () => {
    expect(verhoeffCheckDigit('236')).toBe(3);
    expect(verhoeffValid('2363')).toBe(true);
    expect(verhoeffValid('2364')).toBe(false);
  });

  it('round-trips: a generated check digit always validates', () => {
    for (const base of ['23456789012', '98765432109', '50000000001']) {
      expect(verhoeffValid(base + verhoeffCheckDigit(base))).toBe(true);
    }
  });

  it('catches every single-digit typo in a valid number', () => {
    const valid = '23456789012' + verhoeffCheckDigit('23456789012');
    for (let i = 0; i < valid.length; i++) {
      const wrong = valid.slice(0, i) + ((Number(valid[i]) + 1) % 10) + valid.slice(i + 1);
      expect(verhoeffValid(wrong)).toBe(false);
    }
  });
});

describe('Aadhaar check (warns, never blocks)', () => {
  const valid = '23456789012' + verhoeffCheckDigit('23456789012');
  it('passes a valid number, with or without spaces', () => {
    expect(checkAadhaar(valid).level).toBe('ok');
    expect(checkAadhaar(formatAadhaar(valid)).level).toBe('ok');
  });
  it('warns on length, a leading 0 or 1, and a failed check digit', () => {
    expect(checkAadhaar('12345').level).toBe('warn');
    expect(checkAadhaar('123456789012').message).toMatch(/never start with 0 or 1/);
    expect(checkAadhaar(valid.slice(0, 11) + ((Number(valid[11]) + 1) % 10)).message).toMatch(/check/);
  });
  it('is fine when empty (the number is optional)', () => {
    expect(checkAadhaar('').level).toBe('ok');
  });
  it('formats 4-4-4', () => {
    expect(formatAadhaar('234567890124')).toBe('2345 6789 0124');
  });
});

describe('PAN, passport, IFSC', () => {
  it('PAN: 5 letters, 4 digits, 1 letter, any case', () => {
    expect(checkPan('abcpe1234f').level).toBe('ok');
    expect(checkPan('ABCPE12345').level).toBe('warn');
  });
  it('passport: 1 letter and 7 digits', () => {
    expect(checkPassport('z1234567').level).toBe('ok');
    expect(checkPassport('Z123456').level).toBe('warn');
  });
  it('IFSC: 4 letters, a zero, 6 characters', () => {
    expect(checkIfsc('sbin0001234').level).toBe('ok');
    expect(checkIfsc('SBIN1001234').level).toBe('warn');
  });
});

describe('contact details', () => {
  it('email is required only when asked', () => {
    expect(checkEmail('', true).level).toBe('error');
    expect(checkEmail('').level).toBe('ok');
    expect(checkEmail('papa@example').level).toBe('error');
    expect(checkEmail('papa@example.com').level).toBe('ok');
  });
  it('Indian mobiles: 10 digits starting 6 to 9, +91 optional; foreign numbers allowed', () => {
    expect(checkPhone('+91 98100 12345').level).toBe('ok');
    expect(checkPhone('9810012345').level).toBe('ok');
    expect(checkPhone('5810012345').level).toBe('warn');
    expect(checkPhone('98100').level).toBe('warn');
    expect(checkPhone('+1 415 555 0100').level).toBe('ok');
  });
  it('passwords: 8+ characters, not a common one', () => {
    expect(checkNewPassword('short1').level).toBe('error');
    expect(checkNewPassword('password').level).toBe('error');
    expect(checkNewPassword('onlyletters').level).toBe('warn');
    expect(checkNewPassword('almari2026').level).toBe('ok');
  });
});

describe('cards', () => {
  it('Luhn accepts the standard test numbers and rejects a typo', () => {
    expect(luhnValid('4111 1111 1111 1111')).toBe(true);
    expect(luhnValid('5555555555554444')).toBe(true);
    expect(luhnValid('378282246310005')).toBe(true);
    expect(luhnValid('4111111111111112')).toBe(false);
  });
  it('card number is required; a bad checksum only warns', () => {
    expect(checkCardNumber('').level).toBe('error');
    expect(checkCardNumber('4111111111111112').level).toBe('warn');
  });
  it('expiry is MM/YY', () => {
    expect(checkCardExpiry('08/29').level).toBe('ok');
    expect(checkCardExpiry('13/29').level).toBe('warn');
    expect(checkCardExpiry('2029-08').level).toBe('warn');
  });
});

describe('document rules', () => {
  it('title is required and up to 50 characters', () => {
    expect(checkDocTitle('').level).toBe('error');
    expect(checkDocTitle('   ').level).toBe('error');
    expect(checkDocTitle('a'.repeat(LIMITS.docTitle)).level).toBe('ok');
    expect(checkDocTitle('a'.repeat(LIMITS.docTitle + 1)).level).toBe('error');
  });
  it('counts code points: an emoji counts once, a Hindi vowel sign counts separately', () => {
    expect(charLength('पापा का पैन')).toBe(11);
    expect(charLength('🏠')).toBe(1);
  });
  it('description is optional, up to 200 characters', () => {
    expect(checkDocDescription(undefined).level).toBe('ok');
    expect(checkDocDescription('x'.repeat(200)).level).toBe('ok');
    expect(checkDocDescription('x'.repeat(201)).level).toBe('error');
  });
  it('task title is up to 80 characters', () => {
    expect(checkTaskTitle('x'.repeat(81)).level).toBe('error');
  });
  it('file is required, of an allowed type, and at most 10 MB', () => {
    expect(checkFile(null).level).toBe('error');
    expect(checkFile({ name: 'pan.jpg', size: LIMITS.fileBytes }).level).toBe('ok');
    expect(checkFile({ name: 'pan.jpg', size: LIMITS.fileBytes + 1 }).level).toBe('error');
    expect(checkFile({ name: 'IMG_0001.HEIC', size: 1000 }).level).toBe('ok');
    expect(checkFile({ name: 'deed.docx', size: 1000 }).level).toBe('ok');
    expect(checkFile({ name: 'virus.exe', size: 1000 }).level).toBe('error');
  });
  it('trusts the extension first, then the MIME type', () => {
    expect(fileKindOf('scan', 'application/pdf')).toBe('pdf');
    expect(fileKindOf('photo.PNG')).toBe('image');
    expect(fileKindOf('data.bin', 'application/octet-stream')).toBeNull();
  });
});
