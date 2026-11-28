// Horizontal padding of the call screen, on both sides, and the gap between tiles.
const SCREEN_PADDING = 32;
const TILE_GAP = 8;

// A phone is narrow: one tile takes the whole row, two or more go in pairs.
export const gridColumns = (count: number) => (count === 1 ? 1 : 2);

export const tileWidth = (screenWidth: number, count: number) => {
  const columns = gridColumns(count);
  return Math.floor((screenWidth - SCREEN_PADDING - TILE_GAP * (columns - 1)) / columns);
};
