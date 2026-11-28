// Horizontal padding of the call screen, on both sides, and the gap between tiles.
const SCREEN_PADDING = 32;
const TILE_GAP = 8;

// A phone is narrow: one tile takes the whole row, two or more go in pairs.
export const gridColumns = (count: number) => (count === 1 ? 1 : 2);

export const tileWidth = (screenWidth: number, count: number) => {
  const columns = gridColumns(count);
  return Math.floor((screenWidth - SCREEN_PADDING - TILE_GAP * (columns - 1)) / columns);
};

// 3:4, vertical (C9). Explicit because the children of a tile are absolute: with an aspect ratio alone,
// a flex-wrap row stretches the tile to the height of the row, which is 0.
export const tileHeight = (width: number) => Math.round((width * 4) / 3);
