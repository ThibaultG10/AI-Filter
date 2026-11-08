import { describe, expect, it } from 'vitest';
import { createDetectors, detect } from '../src/core/detectors';

const DOMAINS = ['entreprise.local', 'corp.example.net'];

function valuesFor(id: string, text: string): string[] {
  const detectors = createDetectors({ internalDomains: DOMAINS }).filter((d) => d.id === id);
  if (detectors.length !== 1) throw new Error(`détecteur inconnu : ${id}`);
  return detect(text, detectors).map((m) => m.value);
}

type Positive = readonly [text: string, expected: readonly string[]];
interface Case {
  id: string;
  positives: readonly Positive[];
  negatives: readonly string[];
}

// --- Jeux de données partagés -------------------------------------------------

const JWT_A =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const JWT_B = 'eyJhbGciOi.eyJzdWIiOi.abcde12345';
const JWT_C = 'eyJ0eXAiOiJK.eyJpc3MiOiJ4.c2lnbmF0dXJl';

const pem = (type: string, eol = '\n'): string =>
  [`-----BEGIN ${type}-----`, 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC', 'abcdefgh==', `-----END ${type}-----`].join(eol);

const CASES: readonly Case[] = [
  {
    id: 'email',
    positives: [
      ['Écris à jean.dupont@example.com demain', ['jean.dupont@example.com']],
      ['contact:marie_curie+test@sub.domain.fr.', ['marie_curie+test@sub.domain.fr']],
      ['a@b.io', ['a@b.io']],
      ['<paul-henri@mail.company.co.uk>', ['paul-henri@mail.company.co.uk']],
      ['EMAIL: J.DOE@COMPANY.ORG ok', ['J.DOE@COMPANY.ORG']],
      ['x.y%z@dom-ain.com', ['x.y%z@dom-ain.com']],
      ['support@123.fr', ['support@123.fr']],
      ['a: elodie.martin@exemple.fr, b: paul@x.com', ['elodie.martin@exemple.fr', 'paul@x.com']],
      ['mailto:contact@entreprise.com?subject=Hi', ['contact@entreprise.com']],
      ['first.last@university.edu.au', ['first.last@university.edu.au']],
    ],
    negatives: [
      'pas d email ici',
      '@mention seul',
      'jean@',
      'jean@localhost',
      'a@b',
      'texte@.com',
      'user@@domain.com',
      'prix: 5€ @ 3 pièces',
      'twitter @jean_dupont',
      'foo@bar.',
      '2024-01-01',
      'a b@c',
    ],
  },
  {
    id: 'phone-fr',
    positives: [
      ['Appelle le 06 12 34 56 78 ce soir', ['06 12 34 56 78']],
      ['0612345678', ['0612345678']],
      ['+33 6 12 34 56 78', ['+33 6 12 34 56 78']],
      ['tel:+33612345678', ['+33612345678']],
      ['0033 6 12 34 56 78', ['0033 6 12 34 56 78']],
      ['Fixe : 01.23.45.67.89.', ['01.23.45.67.89']],
      ['01-23-45-67-89', ['01-23-45-67-89']],
      ['+33 (0)1 23 45 67 89', ['+33 (0)1 23 45 67 89']],
      ['Tel: 07 98 76 54 32.', ['07 98 76 54 32']],
      ['06 12 34 56 78 / 04 91 23 45 67', ['06 12 34 56 78', '04 91 23 45 67']],
    ],
    negatives: [
      '12 34 56 78 90',
      '00 12 34 56 78',
      '0123456',
      '061234567',
      '06123456789',
      '2024-06-12',
      '123456789012',
      'IP 10.20.30.40',
      '+44 7911 123456',
      '06 12 34 56',
      'Version 1.2.3.4',
      '01 23 45 67 8',
      'prix 3,141592653',
    ],
  },
  {
    id: 'phone-intl',
    positives: [
      ['Contact : +44 7911 123456.', ['+44 7911 123456']],
      ['Contact : +1 (555) 123-4567.', ['+1 (555) 123-4567']],
      ['Contact : +49 30 12345678.', ['+49 30 12345678']],
      ['Contact : +34 612 345 678.', ['+34 612 345 678']],
      ['Contact : +81 3-1234-5678.', ['+81 3-1234-5678']],
      ['Contact : +39 06 1234 5678.', ['+39 06 1234 5678']],
      ['Contact : +212 612345678.', ['+212 612345678']],
      ['Contact : +1-202-555-0143.', ['+1-202-555-0143']],
      ['Contact : +32 470 12 34 56.', ['+32 470 12 34 56']],
      ['Contact : +41 79 123 45 67.', ['+41 79 123 45 67']],
    ],
    negatives: [
      '+',
      '+33',
      '+1 23',
      '1234567890',
      '+0 123 456 7890',
      'a+44 7911 123456',
      '2+2=4',
      '++44 7911 123456',
      '+44 79',
      'tel +1 2 3',
      'ID +1234567890123456789',
      '+ 44 7911 123456',
    ],
  },
  {
    id: 'ipv4',
    positives: [
      ['Serveur 192.168.1.1 prêt', ['192.168.1.1']],
      ['10.0.0.255', ['10.0.0.255']],
      ['8.8.8.8', ['8.8.8.8']],
      ['255.255.255.255', ['255.255.255.255']],
      ['0.0.0.0', ['0.0.0.0']],
      ['172.16.254.1', ['172.16.254.1']],
      ['serveur 10.20.30.40:8080', ['10.20.30.40']],
      ['ip=127.0.0.1;', ['127.0.0.1']],
      ['(192.168.0.10)', ['192.168.0.10']],
      ['Connexion depuis 203.0.113.42.', ['203.0.113.42']],
    ],
    negatives: [
      '256.1.1.1',
      '1.2.3',
      '1.2.3.4.5',
      '999.999.999.999',
      '12.5.2024',
      'abc',
      '1234.1.1.1',
      '192.168.1',
      '300.300.300.300',
      '1.1.1.1111',
      '01.02.03.004',
      '10.0.0.-1',
      '0.0.0.256',
    ],
  },
  {
    id: 'ipv6',
    positives: [
      ['2001:0db8:85a3:0000:0000:8a2e:0370:7334', ['2001:0db8:85a3:0000:0000:8a2e:0370:7334']],
      ['addr 2001:db8::1 ok', ['2001:db8::1']],
      ['fe80::1', ['fe80::1']],
      ['loopback ::1', ['::1']],
      ['2001:db8:85a3::8a2e:370:7334', ['2001:db8:85a3::8a2e:370:7334']],
      ['1:2:3:4:5:6:7:8', ['1:2:3:4:5:6:7:8']],
      ['fe80::1ff:fe23:4567:890a', ['fe80::1ff:fe23:4567:890a']],
      ['addr 2001:db8:: end', ['2001:db8::']],
      ['2606:4700:4700::1111', ['2606:4700:4700::1111']],
      ['[2001:db8::1]:443', ['2001:db8::1']],
    ],
    negatives: [
      '12:30:45',
      '10:30',
      'http://example.com',
      'std::string',
      'abcd::efgh',
      '1:2:3:4:5:6:7:8:9',
      '12345::1',
      '2001:db8::1::2',
      'ratio 16:9',
      'deadbeef',
      'dead',
      'a:b',
      '1:2:3',
      '00:1A:2B:3C:4D:5E',
      '::',
      'Note: voir ci-dessous',
    ],
  },
  {
    id: 'iban',
    positives: [
      ['IBAN: FR76 3000 6000 0112 3456 7890 189 merci', ['FR76 3000 6000 0112 3456 7890 189']],
      ['FR7630006000011234567890189', ['FR7630006000011234567890189']],
      ['GB82 WEST 1234 5698 7654 32', ['GB82 WEST 1234 5698 7654 32']],
      ['GB82WEST12345698765432', ['GB82WEST12345698765432']],
      ['DE89 3704 0044 0532 0130 00', ['DE89 3704 0044 0532 0130 00']],
      ['FR14 2004 1010 0505 0001 3M02 606', ['FR14 2004 1010 0505 0001 3M02 606']],
      ['ES91 2100 0418 4502 0005 1332', ['ES91 2100 0418 4502 0005 1332']],
      ['IT60 X054 2811 1010 0000 0123 456', ['IT60 X054 2811 1010 0000 0123 456']],
      ['BE68 5390 0754 7034', ['BE68 5390 0754 7034']],
      ['NL91 ABNA 0417 1643 00', ['NL91 ABNA 0417 1643 00']],
      ['CH93 0076 2011 6238 5295 7', ['CH93 0076 2011 6238 5295 7']],
      ['PT50 0002 0123 1234 5678 9015 4', ['PT50 0002 0123 1234 5678 9015 4']],
    ],
    negatives: [
      'FR76 3000 6000 0112 3456 7890 188',
      'GB82 WEST 1234 5698 7654 33',
      'DE89 3704 0044 0532 0130 01',
      'FR76',
      'ABCD 1234 5678',
      'XX00 0000 0000 0000',
      'FR14 2004 1010 0505 0001 3M02 607',
      'ES91 2100 0418 4502 0005 1333',
      'BE68 5390 0754 7035',
      'NL91 ABNA 0417 1643 01',
      'Référence ABCD1234 EFGH5678',
      'fr76 3000 6000 0112 3456 7890 189',
    ],
  },
  {
    id: 'nir',
    positives: [
      ['N° sécu : 1 85 05 78 006 084 91.', ['1 85 05 78 006 084 91']],
      ['N° sécu : 2 69 05 49 588 157 80.', ['2 69 05 49 588 157 80']],
      ['N° sécu : 178027512345677.', ['178027512345677']],
      ['N° sécu : 2 00 01 75 001 002 90.', ['2 00 01 75 001 002 90']],
      ['N° sécu : 1 99 10 13 055 123 22.', ['1 99 10 13 055 123 22']],
      ['N° sécu : 2 76 11 35 012 345 37.', ['2 76 11 35 012 345 37']],
      ['N° sécu : 1 63 04 69 123 456 36.', ['1 63 04 69 123 456 36']],
      ['N° sécu : 1 85 06 2A 123 456 49.', ['1 85 06 2A 123 456 49']],
      ['N° sécu : 1 85 06 2B 123 456 76.', ['1 85 06 2B 123 456 76']],
      ['N° sécu : 2 92 06 92 012 345 59.', ['2 92 06 92 012 345 59']],
    ],
    negatives: [
      '1 85 05 78 006 084 92',
      '2 69 05 49 588 157 81',
      '1850578006084',
      '3 85 05 78 006 084 91',
      '1 85 13 78 006 084 91',
      '0 85 05 78 006 084 91',
      'tel 12345678901234',
      '1 85 05 78 006 084',
      '2690549588157801',
      '1 85 06 2A 123 456 50',
      '1 78 02 75 123 456 78',
    ],
  },
  {
    id: 'ssn',
    positives: [
      ['123-45-6789', ['123-45-6789']],
      ['SSN: 219-09-9999', ['219-09-9999']],
      ['078 05 1120', ['078 05 1120']],
      ['(001-01-0001)', ['001-01-0001']],
      ['id 665-12-3456.', ['665-12-3456']],
      ['667-12-3456', ['667-12-3456']],
      ['899-99-9999', ['899-99-9999']],
      ['a 457-55-5462 b', ['457-55-5462']],
      ['SSN 321-54-9876, DOB 1980', ['321-54-9876']],
      ['two: 123-45-6789 and 234-56-7890', ['123-45-6789', '234-56-7890']],
    ],
    negatives: [
      '000-12-3456',
      '666-12-3456',
      '900-12-3456',
      '999-99-9999',
      '123-00-4567',
      '123-45-0000',
      '123456789',
      '123-456-7890',
      '1234-56-7890',
      '123-45-67890',
      '123-45 6789',
      '2024-12-25',
    ],
  },
  {
    id: 'nino',
    positives: [
      ['AB123456C', ['AB123456C']],
      ['AB 12 34 56 C', ['AB 12 34 56 C']],
      ['NI: JG103377A', ['JG103377A']],
      ['CE 98 76 54 D', ['CE 98 76 54 D']],
      ['ZX123456B', ['ZX123456B']],
      ['(AA123456A)', ['AA123456A']],
      ['my number is TW 45 67 89 A.', ['TW 45 67 89 A']],
      ['OA123456A', ['OA123456A']],
      ['HM 00 00 01 A', ['HM 00 00 01 A']],
      ['SC112233D, PL445566B', ['SC112233D', 'PL445566B']],
    ],
    negatives: [
      'DA123456C',
      'FA123456C',
      'IA123456C',
      'QQ123456C',
      'UA123456C',
      'VA123456C',
      'AD123456C',
      'AO123456C',
      'BG123456C',
      'GB123456C',
      'NK123456C',
      'KN123456C',
      'TN123456C',
      'NT123456C',
      'ZZ123456C',
      'AB123456E',
      'AB12345C',
      'AB1234567C',
      'ab123456c',
      'XAB123456C',
    ],
  },
  {
    id: 'phone-us',
    positives: [
      ['(415) 555-2671', ['(415) 555-2671']],
      ['415-555-2671', ['415-555-2671']],
      ['415.555.2671', ['415.555.2671']],
      ['415 555 2671', ['415 555 2671']],
      ['+1 415 555 2671', ['+1 415 555 2671']],
      ['1-800-555-0199', ['1-800-555-0199']],
      ['+1 (212) 555-0100', ['+1 (212) 555-0100']],
      ['call 202-555-0143 now', ['202-555-0143']],
      ['tel:310.555.0123, fax 212-555-0188', ['310.555.0123', '212-555-0188']],
      ['(650)555-1234.', ['(650)555-1234']],
    ],
    negatives: [
      '123-456-7890',
      '415-155-2671',
      '055-555-2671',
      '415-555-267',
      '415-555-26711',
      '4155552671',
      'ref415-555-2671',
      '415-555-2671-9',
      '4111 1111 1111 1111',
      '2024-12-25',
      '12-345-6789',
      '1234 555 2671',
    ],
  },
  {
    id: 'phone-uk',
    positives: [
      ['07911 123456', ['07911 123456']],
      ['07911123456', ['07911123456']],
      ['020 7946 0958', ['020 7946 0958']],
      ['0121 496 0000', ['0121 496 0000']],
      ['01632 960001', ['01632 960001']],
      ['0800 123 4567', ['0800 123 4567']],
      ['0345 123 4567', ['0345 123 4567']],
      ['call 0113 496 0123 today', ['0113 496 0123']],
      ['mob 07700900123, home 02079460958', ['07700900123', '02079460958']],
      ['(07911 123456)', ['07911 123456']],
    ],
    negatives: [
      '06 12 34 56 78',
      '07 12 34 56 78',
      '01 23 45 67 89',
      '0791112345',
      '079111234567',
      '+44 7911 123456',
      '17911 123456',
      '07911 1234567',
      '0900 123',
      '1020 7946 0958',
      '20-07-1946',
      '7911123456',
    ],
  },
  {
    id: 'siret',
    positives: [
      ['SIRET 73282932000017.', ['73282932000017']],
      ['SIRET 443 061 841 00021.', ['443 061 841 00021']],
      ['SIRET 55203253400034.', ['55203253400034']],
      ['SIRET 389 123 456 00045.', ['389 123 456 00045']],
      ['SIRET 81234567800054.', ['81234567800054']],
      ['SIRET 901 234 567 00062.', ['901 234 567 00062']],
      ['SIRET 40483304000078.', ['40483304000078']],
      ['SIRET 312 345 678 00089.', ['312 345 678 00089']],
      ['SIRET 21380001000091.', ['21380001000091']],
      ['SIRET 623 456 789 00105.', ['623 456 789 00105']],
    ],
    negatives: [
      '73282932000018',
      '443 061 841 00022',
      '7328293200001',
      '732829320000170',
      '73282932 000017',
      'SIRET: abc',
      '123 456 789 000',
      '38912345600046',
      '81234567800055',
      'tel 06 12 34 56 78 90 12',
    ],
  },
  {
    id: 'siren',
    positives: [
      ['SIREN 732829320', ['732829320']],
      ['SIREN 732 829 320', ['732 829 320']],
      ['SIREN 552032534.', ['552032534']],
      ['SIREN 443 061 841.', ['443 061 841']],
      ['SIREN 389123456', ['389123456']],
      ['SIREN 812 345 676', ['812 345 676']],
      ['SIREN 901234567', ['901234567']],
      ['SIREN 404 833 048', ['404 833 048']],
      ['SIREN 312345671', ['312345671']],
      ['SIREN : 213 800 014.', ['213 800 014']],
      ['SIREN 623456787', ['623456787']],
    ],
    negatives: [
      '732829321',
      '552032535',
      '443061842',
      '389123457',
      '812345677',
      '73282932',
      '7328293200',
      '123 456 78',
      '999999999',
      '73282932000017',
      '732 829 320 00017',
      'tel 06 12 34 56 78',
    ],
  },
  {
    id: 'card',
    positives: [
      ['Carte : 4111 1111 1111 1111.', ['4111 1111 1111 1111']],
      ['Carte : 4111-1111-1111-1111.', ['4111-1111-1111-1111']],
      ['Carte : 5555555555554444.', ['5555555555554444']],
      ['Carte : 3782 822463 10005.', ['3782 822463 10005']],
      ['Carte : 6011 1111 1111 1117.', ['6011 1111 1111 1117']],
      ['Carte : 3530 1113 3330 0000.', ['3530 1113 3330 0000']],
      ['Carte : 30569309025904.', ['30569309025904']],
      ['Carte : 4012888888881881.', ['4012888888881881']],
      ['Carte : 5105 1051 0510 5100.', ['5105 1051 0510 5100']],
      ['Carte : 4222222222222.', ['4222222222222']],
      ['Carte : 2223 0031 2200 3222.', ['2223 0031 2200 3222']],
      ['Carte : 5200 8282 8282 8210.', ['5200 8282 8282 8210']],
    ],
    negatives: [
      '4111 1111 1111 1112',
      '1234 5678 9012 3456',
      '4111 1111 1111',
      '2024-01-15 2024-01-16',
      '0000 0000 0000 0000',
      '9999999999999999',
      '06 12 34 56 78 90 12 34',
      'Réf 123456789012345678901234',
      '5555 5555 5555 4445',
      '378282246310006',
      '3782822463100050',
    ],
  },
  {
    id: 'api-key-sk',
    positives: [
      ['OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz123456', ['sk-abcdefghijklmnopqrstuvwxyz123456']],
      ['OPENAI_API_KEY=sk-proj-abcdefghijklmnop1234567890', ['sk-proj-abcdefghijklmnop1234567890']],
      ['KEY=sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWX', ['sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWX']],
      ['KEY=sk-0123456789abcdef0123', ['sk-0123456789abcdef0123']],
      ['KEY=sk-AAAAAAAAAAAAAAAA', ['sk-AAAAAAAAAAAAAAAA']],
      ['KEY=sk-abc_def-ghi_jkl-mno_pqr', ['sk-abc_def-ghi_jkl-mno_pqr']],
      ['KEY=sk-live_4eC39HqLyjWDarjtT1zdp7dc', ['sk-live_4eC39HqLyjWDarjtT1zdp7dc']],
      ['KEY=sk-ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ', ['sk-ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ']],
      ['KEY=sk-1a2b3c4d5e6f7g8h9i0j', ['sk-1a2b3c4d5e6f7g8h9i0j']],
      ['KEY=sk-svcacct-abcdefghijklmnopqrstuv', ['sk-svcacct-abcdefghijklmnopqrstuv']],
    ],
    negatives: [
      'sk-short',
      'sk-',
      'task-abcdefghijklmnopqrstuvwx',
      'disk-abcdefghijklmnopqrstuvwxyz',
      'ask-for-the-moon-and-more-things',
      'SK-ABCDEFGHIJKLMNOPQRSTUV',
      'sk_abcdefghijklmnopqrstuvwxyz',
      'sk-abc def',
      'sk-1234567890123',
      'The sk- prefix',
    ],
  },
  {
    id: 'api-key-aws',
    positives: [
      ['aws_access_key_id = AKIAIOSFODNN7EXAMPLE', ['AKIAIOSFODNN7EXAMPLE']],
      ['aws_access_key_id = AKIAABCDEFGHIJKLMNOP', ['AKIAABCDEFGHIJKLMNOP']],
      ['aws_access_key_id = AKIA1234567890ABCDEF', ['AKIA1234567890ABCDEF']],
      ['aws_access_key_id = AKIAZZZZZZZZZZZZZZZZ', ['AKIAZZZZZZZZZZZZZZZZ']],
      ['aws_access_key_id = ASIAIOSFODNN7EXAMPLE', ['ASIAIOSFODNN7EXAMPLE']],
      ['aws_access_key_id = ASIA0123456789012345', ['ASIA0123456789012345']],
      ['aws_access_key_id = AKIAJ3ABCDEFGHIJKLMN', ['AKIAJ3ABCDEFGHIJKLMN']],
      ['aws_access_key_id = AKIAQWERTYUIOPASDFGH', ['AKIAQWERTYUIOPASDFGH']],
      ['aws_access_key_id = ASIAZXCVBNMLKJHGFDSA', ['ASIAZXCVBNMLKJHGFDSA']],
      ['aws_access_key_id = AKIA9876543210ZYXWVU', ['AKIA9876543210ZYXWVU']],
    ],
    negatives: [
      'AKIA123',
      'akiaiosfodnn7example',
      'AKIAIOSFODNN7EXAMPLE1',
      'XAKIAIOSFODNN7EXAMPLE',
      'AKI AIOSFODNN7EXAMPLE',
      'AKIA IOSFODNN7EXAMPLE',
      'AKIAiosfodnn7example',
      'ASI A0123456789012345',
      'AKIA-IOSFODNN7EXAMPLE',
      'Clé : AKIA',
    ],
  },
  {
    id: 'api-key-github',
    positives: [
      ['token ghp_abcdefghijklmnopqrstuvwxyz0123456789', ['ghp_abcdefghijklmnopqrstuvwxyz0123456789']],
      ['token gho_abcdefghijklmnopqrstuvwxyz0123456789', ['gho_abcdefghijklmnopqrstuvwxyz0123456789']],
      ['token ghu_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', ['ghu_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789']],
      ['token ghs_abcdefghijklmnopqrstuvwxyz0123456789', ['ghs_abcdefghijklmnopqrstuvwxyz0123456789']],
      ['token ghr_abcdefghijklmnopqrstuvwxyz0123456789', ['ghr_abcdefghijklmnopqrstuvwxyz0123456789']],
      ['token ghp_abcdefghijklmnopqrstuvwxyz1234', ['ghp_abcdefghijklmnopqrstuvwxyz1234']],
      [`token ghp_${'0123456789'.repeat(4)}`, [`ghp_${'0123456789'.repeat(4)}`]],
      [`token ghp_${'AaBb'.repeat(10)}`, [`ghp_${'AaBb'.repeat(10)}`]],
      [`token ghp_${'Z'.repeat(36)}`, [`ghp_${'Z'.repeat(36)}`]],
      [`token ghp_${'a1b2c3'.repeat(6)}`, [`ghp_${'a1b2c3'.repeat(6)}`]],
    ],
    negatives: [
      'ghp_short',
      'ghx_abcdefghijklmnopqrstuvwxyz0123456789',
      'ghp-abcdefghijklmnopqrstuvwxyz0123456789',
      'GHP_abcdefghijklmnopqrstuvwxyz0123456789',
      `ghp_${'a'.repeat(29)}`,
      'aghp_abcdefghijklmnopqrstuvwxyz0123456789',
      'ghp_ abcdefghijklmnopqrstuvwxyz0123456789',
      'github token',
      'ghp',
      'ghp_abc!def',
    ],
  },
  {
    id: 'api-key-slack',
    positives: [
      ['SLACK_TOKEN=xo' + 'xb-123456789012-abcdefghijklmnop', ['xo' + 'xb-123456789012-abcdefghijklmnop']],
      ['SLACK_TOKEN=xo' + 'xp-1234567890-0987654321-AbCdEfGhIjKlMnOp', ['xo' + 'xp-1234567890-0987654321-AbCdEfGhIjKlMnOp']],
      ['SLACK_TOKEN=xo' + 'xa-1234567890-abcdef', ['xo' + 'xa-1234567890-abcdef']],
      ['SLACK_TOKEN=xo' + 'xr-1234567890abcdef', ['xo' + 'xr-1234567890abcdef']],
      ['SLACK_TOKEN=xo' + 'xs-1234567890-1234567890', ['xo' + 'xs-1234567890-1234567890']],
      [
        'SLACK_TOKEN=xo' + 'xb-1234567890-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx',
        ['xo' + 'xb-1234567890-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx'],
      ],
      ['SLACK_TOKEN=xo' + 'xb-0000000000', ['xo' + 'xb-0000000000']],
      ['SLACK_TOKEN=xo' + 'xp-abcdefghijklmnop', ['xo' + 'xp-abcdefghijklmnop']],
      ['SLACK_TOKEN=xo' + 'xa-ZZZZZZZZZZ', ['xo' + 'xa-ZZZZZZZZZZ']],
      ['SLACK_TOKEN=xo' + 'xb-9-8-7-6-5-4-3-2-1-0-9-8', ['xo' + 'xb-9-8-7-6-5-4-3-2-1-0-9-8']],
    ],
    negatives: [
      'xo' + 'xb-short',
      'xo' + 'xz-1234567890123',
      'xo' + 'x-1234567890123',
      'XOXB-1234567890123',
      'axo' + 'xb-1234567890123',
      'xo' + 'xb_1234567890123',
      'xo' + 'xb-',
      'xo' + 'xb- 1234567890',
      'xo' + 'xb-12345',
      'xo' + 'xb-abc',
    ],
  },
  {
    id: 'jwt',
    positives: [
      [`Authorization: Bearer ${JWT_A}`, [JWT_A]],
      [`{"token":"${JWT_A}"}`, [JWT_A]],
      [JWT_B, [JWT_B]],
      [`token=${JWT_C}&x=1`, [JWT_C]],
      ['eyJhbGciOiJSUzI1NiJ9.eyJ1c2VyIjoiYSJ9.sig_ABC-123', ['eyJhbGciOiJSUzI1NiJ9.eyJ1c2VyIjoiYSJ9.sig_ABC-123']],
      ['eyJabcde.eyJfghij.klmno', ['eyJabcde.eyJfghij.klmno']],
      ['eyJhbGciOiJub25lIn0.eyJhIjoxfQ12.AAAAA', ['eyJhbGciOiJub25lIn0.eyJhIjoxfQ12.AAAAA']],
      [`(${JWT_B})`, [JWT_B]],
      [`${JWT_A} et ${JWT_B}`, [JWT_A, JWT_B]],
      [`jwt: ${JWT_C}.`, [JWT_C]],
    ],
    negatives: [
      'eyJhbGciOiJIUzI1NiJ9',
      'eyJabc.def',
      'eyJa.b.c',
      'xeyJhbGciOiJIUzI1NiIsInR5c.eyJzdWIiOiIx.abcde12345',
      'EYJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIx.abcde12345',
      'eyJhbGciOi..abcde12345',
      'foo.bar.baz',
      'abc.eyJhbGciOiJIUzI1.sig12345',
      'eyJ',
      'eyJ.eyJ.eyJ',
    ],
  },
  {
    id: 'pem',
    positives: [
      [pem('RSA PRIVATE KEY'), [pem('RSA PRIVATE KEY')]],
      [pem('PRIVATE KEY'), [pem('PRIVATE KEY')]],
      [pem('EC PRIVATE KEY'), [pem('EC PRIVATE KEY')]],
      [pem('OPENSSH PRIVATE KEY'), [pem('OPENSSH PRIVATE KEY')]],
      [pem('ENCRYPTED PRIVATE KEY'), [pem('ENCRYPTED PRIVATE KEY')]],
      [pem('DSA PRIVATE KEY'), [pem('DSA PRIVATE KEY')]],
      [`Voici ma clé :\n${pem('RSA PRIVATE KEY')}\nmerci`, [pem('RSA PRIVATE KEY')]],
      ['-----BEGIN RSA PRIVATE KEY-----', ['-----BEGIN RSA PRIVATE KEY-----']],
      [pem('PRIVATE KEY', '\r\n'), [pem('PRIVATE KEY', '\r\n')]],
      ['-----BEGIN PRIVATE KEY-----\nMIIEvQ', ['-----BEGIN PRIVATE KEY-----']],
    ],
    negatives: [
      '-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PUBLIC KEY-----',
      '-----BEGIN CERTIFICATE-----\nMIIC\n-----END CERTIFICATE-----',
      'PRIVATE KEY',
      '-----BEGIN RSA PRIVATE KEY',
      '----BEGIN PRIVATE KEY----',
      'begin private key',
      '-----BEGIN-----',
      '-----END PRIVATE KEY-----',
      '-----BEGIN PGP PUBLIC KEY BLOCK-----',
      '-----BEGIN CERTIFICATE REQUEST-----',
    ],
  },
  {
    id: 'internal-url',
    positives: [
      ['Voir https://git.entreprise.local/projet/repo pour le code', ['https://git.entreprise.local/projet/repo']],
      ['http://intranet.entreprise.local:8080/admin', ['http://intranet.entreprise.local:8080/admin']],
      ['serveur.entreprise.local', ['serveur.entreprise.local']],
      ['entreprise.local', ['entreprise.local']],
      ['https://app.corp.example.net/login?next=/home', ['https://app.corp.example.net/login?next=/home']],
      ['db01.prod.entreprise.local.', ['db01.prod.entreprise.local']],
      ['ssh jean@srv.entreprise.local', ['srv.entreprise.local']],
      ['HTTPS://WIKI.ENTREPRISE.LOCAL/Page', ['HTTPS://WIKI.ENTREPRISE.LOCAL/Page']],
      ['x.corp.example.net:443', ['x.corp.example.net:443']],
      ['(https://jira.entreprise.local/browse/ABC-1)', ['https://jira.entreprise.local/browse/ABC-1']],
      ['voir https://git.entreprise.local/phenix.', ['https://git.entreprise.local/phenix']],
      ['voir https://git.entreprise.local/a/b?x=1, merci', ['https://git.entreprise.local/a/b?x=1']],
    ],
    negatives: [
      'https://www.google.com',
      'entreprise.com',
      'monentreprise.local',
      'local',
      'entreprise',
      'corp.example.com',
      'example.net',
      'entreprise.localhost',
      'entreprise-local',
      'contact@entreprise.com',
      'http://localhost:3000',
      'ftp.entreprise.org',
    ],
  },
];

describe('détecteurs : cas positifs et négatifs', () => {
  it('couvre tous les détecteurs déclarés', () => {
    expect(CASES.map((c) => c.id).sort()).toEqual(createDetectors().map((d) => d.id).sort());
  });

  for (const c of CASES) {
    describe(c.id, () => {
      it('a au moins 10 cas positifs et 10 cas négatifs', () => {
        expect(c.positives.length).toBeGreaterThanOrEqual(10);
        expect(c.negatives.length).toBeGreaterThanOrEqual(10);
      });

      c.positives.forEach(([text, expected], i) => {
        it(`positif #${i + 1}`, () => {
          expect(valuesFor(c.id, text)).toEqual(expected);
        });
      });

      c.negatives.forEach((text, i) => {
        it(`négatif #${i + 1}`, () => {
          expect(valuesFor(c.id, text)).toEqual([]);
        });
      });
    });
  }
});

describe('configuration des détecteurs', () => {
  it('désactive « internal-url » tant qu\'aucun domaine n\'est fourni', () => {
    const d = createDetectors().find((x) => x.id === 'internal-url');
    expect(d?.enabled).toBe(false);
    expect(detect('https://git.entreprise.local/x')).toEqual([]);
  });

  it('active « internal-url » dès qu\'un domaine est fourni', () => {
    const d = createDetectors({ internalDomains: ['*.entreprise.local'] }).find((x) => x.id === 'internal-url');
    expect(d?.enabled).toBe(true);
    expect(detect('wiki.entreprise.local', createDetectors({ internalDomains: ['*.entreprise.local'] }))).toHaveLength(1);
  });

  it('ignore les domaines invalides', () => {
    const detectors = createDetectors({ internalDomains: ['', '   ', '(a|b)', '.'] });
    expect(detectors.find((x) => x.id === 'internal-url')?.enabled).toBe(false);
  });

  it('respecte la surcharge « enabled »', () => {
    const detectors = createDetectors({ enabled: { email: false } });
    expect(detect('jean@example.com', detectors)).toEqual([]);
    expect(detect('jean@example.com')).toHaveLength(1);
  });

  it('ne change pas d\'état entre deux appels (pas de lastIndex partagé)', () => {
    const text = 'jean@example.com et paul@example.com';
    expect(detect(text)).toEqual(detect(text));
  });
});
