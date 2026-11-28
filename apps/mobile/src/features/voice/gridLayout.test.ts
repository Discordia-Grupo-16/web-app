import { gridColumns, tileHeight, tileWidth } from './gridLayout';
import { participantInitial } from './participantInitial';

describe('gridColumns', () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 2],
    [8, 2],
  ] as const)('gives %i tile(s) %i column(s)', (tiles, columns) => {
    expect(gridColumns(tiles)).toBe(columns);
  });

  it('does not break with nobody', () => {
    expect(gridColumns(0)).toBe(2);
  });
});

describe('tileWidth', () => {
  it('gives a tile alone the screen minus its padding', () => {
    expect(tileWidth(400, 1)).toBe(368);
  });

  it('splits two columns and the gap between them', () => {
    expect(tileWidth(400, 2)).toBe(180);
  });

  it('rounds down, so the row never overflows', () => {
    expect(tileWidth(401, 2)).toBe(180);
  });
});

describe('tileHeight', () => {
  it('is 3:4, vertical (C9)', () => {
    expect(tileHeight(180)).toBe(240);
    expect(tileHeight(368)).toBe(491);
  });

  it('rounds to a whole number', () => {
    expect(tileHeight(185)).toBe(247);
  });
});

describe('participantInitial', () => {
  it.each([
    ['Ana', 'A'],
    ['  beto', 'B'],
    ['', '?'],
    ['   ', '?'],
  ] as const)('gives the letter for %p: %p', (name, letter) => {
    expect(participantInitial(name)).toBe(letter);
  });
});
