// 1 tile: one column; from 2 to 4: two; 5 or more: three (C9).
export const gridColumns = (count: number) => (count <= 1 ? 1 : count <= 4 ? 2 : 3);
