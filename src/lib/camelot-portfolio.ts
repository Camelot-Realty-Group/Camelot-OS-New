/**
 * camelot-portfolio.ts — THE canonical list of properties Camelot currently
 * manages. Supplied by David Goldoff, July 31 2026, with the instruction
 * "never forget this list." This module is the single source of truth for
 * portfolio maps, pitch decks, coverage claims, and manager routing.
 *
 * Do not edit casually: additions/removals should reflect real portfolio
 * changes confirmed by Camelot leadership.
 */

export interface CamelotProperty {
  portfolioId: number;
  propertyName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  managerGroup: string;
  mapNote?: string;
}

export const CAMELOT_PORTFOLIO: CamelotProperty[] = [
  { portfolioId: 1, propertyName: '129 Avenue D / 748 East 9th Street', address: '748 East 9th Street', city: 'New York', state: 'NY', zip: '10009', managerGroup: 'Jake / Danielle', mapNote: 'Also referenced internally as 129 Avenue D' },
  { portfolioId: 2, propertyName: '300 West 11th Street', address: '300 West 11th Street', city: 'New York', state: 'NY', zip: '10014', managerGroup: 'Jake / Danielle' },
  { portfolioId: 3, propertyName: '56 Lispenard Street', address: '56 Lispenard Street', city: 'New York', state: 'NY', zip: '10013', managerGroup: 'Jake / Danielle' },
  { portfolioId: 4, propertyName: '39 Spring Street', address: '39 Spring Street', city: 'New York', state: 'NY', zip: '10012', managerGroup: 'Jake / Danielle' },
  { portfolioId: 5, propertyName: '165 East 62nd Street', address: '165 East 62nd Street', city: 'New York', state: 'NY', zip: '10065', managerGroup: 'Jake / Danielle' },
  { portfolioId: 6, propertyName: '253 East 7th Street', address: '253 East 7th Street', city: 'New York', state: 'NY', zip: '10009', managerGroup: 'Jake / Danielle' },
  { portfolioId: 7, propertyName: 'The Catherine Condominium', address: '236 West 24th Street', city: 'New York', state: 'NY', zip: '10011', managerGroup: 'Jake / Danielle' },
  { portfolioId: 8, propertyName: '110 East 97th Street', address: '110 East 97th Street', city: 'New York', state: 'NY', zip: '10029', managerGroup: 'Jake / Danielle' },
  { portfolioId: 9, propertyName: '552 West 43rd Street', address: '552 West 43rd Street', city: 'New York', state: 'NY', zip: '10036', managerGroup: 'Jake / Danielle' },
  { portfolioId: 10, propertyName: '68 Thomas Street Condominium', address: '68 Thomas Street', city: 'New York', state: 'NY', zip: '10013', managerGroup: 'Jake / Danielle' },
  { portfolioId: 11, propertyName: '22nd Street Apartment Corp', address: '260 West 22nd Street', city: 'New York', state: 'NY', zip: '10011', managerGroup: 'Jake / Danielle' },
  { portfolioId: 12, propertyName: 'Park East Owners Corp', address: '105 East 38th Street', city: 'New York', state: 'NY', zip: '10016', managerGroup: 'Jake / Danielle' },
  { portfolioId: 13, propertyName: 'Park Manhattan Condominium', address: '411-417-421 Manhattan Avenue', city: 'New York', state: 'NY', zip: '10026', managerGroup: 'Jake / Danielle', mapNote: 'Three adjoining street addresses managed as one property' },
  { portfolioId: 14, propertyName: 'Royal York Associates LP', address: '420 East 64th Street / 425 East 63rd Street', city: 'New York', state: 'NY', zip: '10065', managerGroup: 'Jake / Danielle', mapNote: 'Through-block property with two street addresses' },
  { portfolioId: 15, propertyName: '86 West Holdings LLC', address: '340 West 86th Street', city: 'New York', state: 'NY', zip: '10024', managerGroup: 'Jake / Danielle' },
  { portfolioId: 16, propertyName: 'Amblunthorp Holding Inc', address: '788 Ninth Avenue', city: 'New York', state: 'NY', zip: '10019', managerGroup: 'Jake / Danielle' },
  { portfolioId: 17, propertyName: '533 Washington', address: '533 Washington Street', city: 'Brooklyn', state: 'NY', zip: '11238', managerGroup: 'Jake / Danielle' },
  { portfolioId: 18, propertyName: '540 Pacific Street', address: '540 Pacific Street', city: 'Brooklyn', state: 'NY', zip: '11217', managerGroup: 'Jake / Danielle' },
  { portfolioId: 19, propertyName: '542 Pacific Street', address: '542 Pacific Street', city: 'Brooklyn', state: 'NY', zip: '11217', managerGroup: 'Jake / Danielle' },
  { portfolioId: 20, propertyName: '557 Pacific Street', address: '557 Pacific Street', city: 'Brooklyn', state: 'NY', zip: '11217', managerGroup: 'Jake / Danielle' },
  { portfolioId: 21, propertyName: 'The Sunnyside Bliss / 48th Woodside Associates', address: '43-33 48th Street', city: 'Long Island City', state: 'NY', zip: '11104', managerGroup: 'Jake / Danielle' },
  { portfolioId: 22, propertyName: 'Vrachnos Associates - 41-28', address: '41-28 55th Street', city: 'Woodside', state: 'NY', zip: '11377', managerGroup: 'Jake / Danielle' },
  { portfolioId: 23, propertyName: 'Vrachnos Associates - 41-34', address: '41-34 55th Street', city: 'Woodside', state: 'NY', zip: '11377', managerGroup: 'Jake / Danielle' },
  { portfolioId: 24, propertyName: '61st 39th Avenue LLC', address: '61-05 to 61-09 39th Avenue', city: 'Woodside', state: 'NY', zip: '11377', managerGroup: 'Jake / Danielle' },
  { portfolioId: 25, propertyName: '83-55 Austin Property Associates', address: '83-55 Austin Street', city: 'Kew Gardens', state: 'NY', zip: '11415', managerGroup: 'Jake / Danielle' },
  { portfolioId: 26, propertyName: '604 West 178th Corp', address: '604 West 178th Street', city: 'New York', state: 'NY', zip: '10033', managerGroup: 'Jake / Danielle' },
  { portfolioId: 27, propertyName: 'Zebrada Properties LLC', address: '410 East 50th Street', city: 'New York', state: 'NY', zip: '10022', managerGroup: 'Jake / Danielle' },
  { portfolioId: 28, propertyName: 'Dore Ventures LLC', address: '43 East 63rd Street', city: 'New York', state: 'NY', zip: '10065', managerGroup: 'Jake / Danielle' },
  { portfolioId: 29, propertyName: '13-14 Jackson Avenue', address: '13-14 Jackson Avenue', city: 'Long Island City', state: 'NY', zip: '11101', managerGroup: 'Jake / Danielle' },
  { portfolioId: 30, propertyName: '130 Berkeley Place', address: '130 Berkeley Place', city: 'Brooklyn', state: 'NY', zip: '11217', managerGroup: 'Hanna' },
  { portfolioId: 31, propertyName: '930 St Nicholas Owners Corp', address: '930 St Nicholas Avenue', city: 'New York', state: 'NY', zip: '10032', managerGroup: 'Valerie / Spencer' },
  { portfolioId: 32, propertyName: '402 Holding Corp', address: '402 West Broadway', city: 'New York', state: 'NY', zip: '10012', managerGroup: 'Valerie / Spencer' },
  { portfolioId: 33, propertyName: '165 Chrystie Street Condominium', address: '165 Chrystie Street', city: 'New York', state: 'NY', zip: '10002', managerGroup: 'Valerie / Spencer' },
  { portfolioId: 34, propertyName: '465 Washington Street Condominium', address: '465 Washington Street', city: 'New York', state: 'NY', zip: '10013', managerGroup: 'Valerie / Spencer' },
  { portfolioId: 35, propertyName: '500 West 25th Street Condominium', address: '500 West 25th Street', city: 'New York', state: 'NY', zip: '10001', managerGroup: 'Valerie / Spencer' },
  { portfolioId: 36, propertyName: '27 Mercer Street Condominium', address: '25-27 Mercer Street', city: 'New York', state: 'NY', zip: '10013', managerGroup: 'Valerie / Spencer' },
  { portfolioId: 37, propertyName: '201 East 15th Owners Corp', address: '201 East 15th Street', city: 'New York', state: 'NY', zip: '10003', managerGroup: 'Valerie / Spencer' },
  { portfolioId: 38, propertyName: 'Chelsea Brownstone Condominium', address: '346 West 22nd Street', city: 'New York', state: 'NY', zip: '10011', managerGroup: 'Valerie / Spencer' },
  { portfolioId: 39, propertyName: 'Park East Condominium', address: '117 East 29th Street', city: 'New York', state: 'NY', zip: '10016', managerGroup: 'Valerie / Spencer' },
  { portfolioId: 40, propertyName: '175 Chrystie Street Condominium', address: '175 Chrystie Street', city: 'New York', state: 'NY', zip: '10002', managerGroup: 'Valerie / Spencer' },
  { portfolioId: 41, propertyName: '949 Park Avenue Condominium', address: '949 Park Avenue', city: 'New York', state: 'NY', zip: '10028', managerGroup: 'Valerie / Spencer' },
  { portfolioId: 42, propertyName: 'White Street Plaza', address: '58 White Street', city: 'New York', state: 'NY', zip: '10013', managerGroup: 'Valerie / Spencer' },
];

/** Single geocodable address string per property (first address for multi-address lots). */
export function portfolioMapAddresses(): string[] {
  return CAMELOT_PORTFOLIO.map(p => {
    const first = p.address.split('/')[0].split(' to ')[0].replace(/^(\d+)-\d+-\d+\s/, '$1 ').trim();
    return `${first}, ${p.city}, ${p.state} ${p.zip}`;
  });
}
