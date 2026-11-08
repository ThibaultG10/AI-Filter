import { describe, expect, it } from 'vitest';
import {
  isPlausibleInternationalPhone,
  isValidCard,
  isValidIban,
  isValidIPv4,
  isValidIPv6,
  isValidNir,
  isValidSiren,
  isValidSiret,
  luhn,
} from '../src/core/validators';

describe('luhn', () => {
  it.each([
    '0',
    '79927398713',
    '4111111111111111',
    '378282246310005',
    '5555555555554444',
    '6011111111111117',
    '30569309025904',
    '4012888888881881',
    '4222222222222',
    '3566002020360505',
  ])('valide %s', (v) => expect(luhn(v)).toBe(true));

  it.each(['', '4111111111111112', '79927398710', '1234567890123456', 'abc', '4111 1111', '123456789', '4111111111111110'])(
    'invalide « %s »',
    (v) => expect(luhn(v)).toBe(false),
  );
});

describe('isValidCard', () => {
  it.each([
    '4111111111111111',
    '4111 1111 1111 1111',
    '4111-1111-1111-1111',
    '5555555555554444',
    '378282246310005',
    '6011111111111117',
    '3530111333300000',
    '30569309025904',
    '4222222222222',
    '2223003122003222',
    '5200828282828210',
  ])('valide %s', (v) => expect(isValidCard(v)).toBe(true));

  it.each([
    '4111111111111112', // Luhn invalide
    '1234567890123456', // préfixe inconnu
    '411111111111', // 12 chiffres
    '41111111111111111111', // 20 chiffres
    '0000000000000000', // préfixe inconnu
    '3782822463100050', // 16 chiffres pour un préfixe Amex (15 attendus)
    '555555555555444', // 15 chiffres pour un préfixe Mastercard (16 attendus)
    '2024011520240116', // deux dates collées
    'abcd',
  ])('invalide %s', (v) => expect(isValidCard(v)).toBe(false));
});

describe('isValidIban', () => {
  it.each([
    'GB82 WEST 1234 5698 7654 32',
    'GB82WEST12345698765432',
    'DE89 3704 0044 0532 0130 00',
    'FR14 2004 1010 0505 0001 3M02 606',
    'FR76 3000 6000 0112 3456 7890 189',
    'ES91 2100 0418 4502 0005 1332',
    'IT60 X054 2811 1010 0000 0123 456',
    'BE68 5390 0754 7034',
    'NL91 ABNA 0417 1643 00',
    'CH93 0076 2011 6238 5295 7',
    'LU28 0019 4006 4475 0000',
    'PT50 0002 0123 1234 5678 9015 4',
    'AT61 1904 3002 3457 3201',
  ])('valide %s', (v) => expect(isValidIban(v)).toBe(true));

  it.each([
    'FR76 3000 6000 0112 3456 7890 188', // clé fausse
    'GB82 WEST 1234 5698 7654 33', // clé fausse
    'FR14 2004 1010 0505 0001 3M02 60', // longueur fausse pour la France
    'DE89 3704 0044 0532 0130 0', // longueur fausse pour l'Allemagne
    'fr14 2004 1010 0505 0001 3M02 606', // minuscules
    'FR14',
    'XX00 0000 0000 0000',
    '',
  ])('invalide « %s »', (v) => expect(isValidIban(v)).toBe(false));
});

describe('isValidNir', () => {
  it.each([
    '1 85 05 78 006 084 91',
    '2 69 05 49 588 157 80',
    '178027512345677',
    '2 00 01 75 001 002 90',
    '1 99 10 13 055 123 22',
    '2 76 11 35 012 345 37',
    '1 63 04 69 123 456 36',
    '2 92 06 92 012 345 59',
    '1 85 06 2A 123 456 49', // Corse du Sud : 2A compte pour 19
    '1 85 06 2B 123 456 76', // Haute-Corse : 2B compte pour 18
  ])('valide %s', (v) => expect(isValidNir(v)).toBe(true));

  it.each([
    '1 85 05 78 006 084 92', // clé fausse
    '2 69 05 49 588 157 81', // clé fausse
    '1 85 06 2A 123 456 50', // clé fausse en Corse
    '1850578006084', // 13 chiffres, sans clé
    '185057800608400', // clé 00 impossible
    '3 85 05 78 006 084 91', // ne commence pas par 1 ou 2
    '1 85 05 78 006 084 9', // trop court
    'abcdefghijklmno',
    '',
  ])('invalide « %s »', (v) => expect(isValidNir(v)).toBe(false));
});

describe('isValidSiren / isValidSiret', () => {
  it.each(['732829320', '552032534', '443061841', '389123456', '812345676', '732 829 320'])('SIREN valide %s', (v) =>
    expect(isValidSiren(v)).toBe(true),
  );
  it.each(['732829321', '55203253', '5520325340', 'abcdefghi', ''])('SIREN invalide « %s »', (v) =>
    expect(isValidSiren(v)).toBe(false),
  );

  it.each(['73282932000017', '44306184100021', '55203253400034', '732 829 320 00017'])('SIRET valide %s', (v) =>
    expect(isValidSiret(v)).toBe(true),
  );
  it.each(['73282932000018', '7328293200001', '732829320000170', 'abcdefghijklmn', ''])('SIRET invalide « %s »', (v) =>
    expect(isValidSiret(v)).toBe(false),
  );

  it('accepte l\'exception La Poste (somme des chiffres multiple de 5)', () => {
    expect(isValidSiret('35600000000065')).toBe(true);
  });
});

describe('isValidIPv4', () => {
  it.each(['0.0.0.0', '8.8.8.8', '10.0.0.255', '127.0.0.1', '172.16.254.1', '192.168.1.1', '203.0.113.42', '255.255.255.255'])(
    'valide %s',
    (v) => expect(isValidIPv4(v)).toBe(true),
  );
  it.each(['256.1.1.1', '1.2.3', '1.2.3.4.5', '01.2.3.4', 'a.b.c.d', '1.2.3.', '', '1..3.4', '1.2.3.-4', '300.1.1.1'])(
    'invalide « %s »',
    (v) => expect(isValidIPv4(v)).toBe(false),
  );
});

describe('isValidIPv6', () => {
  it.each([
    '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
    '2001:db8::1',
    'fe80::1',
    '::1',
    '2001:db8::',
    '1:2:3:4:5:6:7:8',
    'fe80::1ff:fe23:4567:890a',
    '2606:4700:4700::1111',
    'FD00::ABCD',
  ])('valide %s', (v) => expect(isValidIPv6(v)).toBe(true));

  it.each([
    '12:30:45',
    '10:30',
    '::',
    ':::',
    '1:2:3:4:5:6:7:8:9',
    '12345::1',
    '2001:db8::1::2',
    'deadbeef',
    '00:1A:2B:3C:4D:5E',
    'g::1',
    '',
  ])('invalide « %s »', (v) => expect(isValidIPv6(v)).toBe(false));
});

describe('isPlausibleInternationalPhone', () => {
  it('accepte 8 à 15 chiffres', () => {
    expect(isPlausibleInternationalPhone('+44 7911 123456')).toBe(true);
    expect(isPlausibleInternationalPhone('+1 (555) 123-4567')).toBe(true);
    expect(isPlausibleInternationalPhone('+12345678')).toBe(true);
    expect(isPlausibleInternationalPhone('+123456789012345')).toBe(true);
  });
  it('refuse moins de 8 ou plus de 15 chiffres', () => {
    expect(isPlausibleInternationalPhone('+1234567')).toBe(false);
    expect(isPlausibleInternationalPhone('+1234567890123456')).toBe(false);
  });
});
