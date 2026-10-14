/**
 * Piece set (spec 6.1). Every listed orientation is its own piece; there is no rotation.
 * Shapes are written as rows of '#' (block) and '.' (gap).
 */
export interface PieceSpec {
  id: string;
  group: 'single' | 'bar' | 'square' | 'rect' | 'smallL' | 'L' | 'bigL' | 'T' | 'SZ';
  weight: number;
  shape: string[];
}

export const PIECE_SPECS: PieceSpec[] = [
  { id: '1x1', group: 'single', weight: 3, shape: ['#'] },

  { id: 'h2', group: 'bar', weight: 5, shape: ['##'] },
  { id: 'v2', group: 'bar', weight: 5, shape: ['#', '#'] },
  { id: 'h3', group: 'bar', weight: 5, shape: ['###'] },
  { id: 'v3', group: 'bar', weight: 5, shape: ['#', '#', '#'] },
  { id: 'h4', group: 'bar', weight: 5, shape: ['####'] },
  { id: 'v4', group: 'bar', weight: 5, shape: ['#', '#', '#', '#'] },
  { id: 'h5', group: 'bar', weight: 3, shape: ['#####'] },
  { id: 'v5', group: 'bar', weight: 3, shape: ['#', '#', '#', '#', '#'] },

  { id: 'sq2', group: 'square', weight: 6, shape: ['##', '##'] },
  { id: 'sq3', group: 'square', weight: 3, shape: ['###', '###', '###'] },

  { id: 'r23', group: 'rect', weight: 3, shape: ['###', '###'] },
  { id: 'r32', group: 'rect', weight: 3, shape: ['##', '##', '##'] },

  { id: 'sl1', group: 'smallL', weight: 4, shape: ['#.', '##'] },
  { id: 'sl2', group: 'smallL', weight: 4, shape: ['.#', '##'] },
  { id: 'sl3', group: 'smallL', weight: 4, shape: ['##', '#.'] },
  { id: 'sl4', group: 'smallL', weight: 4, shape: ['##', '.#'] },

  { id: 'L1', group: 'L', weight: 3, shape: ['#.', '#.', '##'] },
  { id: 'L2', group: 'L', weight: 3, shape: ['###', '#..'] },
  { id: 'L3', group: 'L', weight: 3, shape: ['##', '.#', '.#'] },
  { id: 'L4', group: 'L', weight: 3, shape: ['..#', '###'] },
  { id: 'J1', group: 'L', weight: 3, shape: ['.#', '.#', '##'] },
  { id: 'J2', group: 'L', weight: 3, shape: ['#..', '###'] },
  { id: 'J3', group: 'L', weight: 3, shape: ['##', '#.', '#.'] },
  { id: 'J4', group: 'L', weight: 3, shape: ['###', '..#'] },

  { id: 'BL1', group: 'bigL', weight: 2, shape: ['#..', '#..', '###'] },
  { id: 'BL2', group: 'bigL', weight: 2, shape: ['..#', '..#', '###'] },
  { id: 'BL3', group: 'bigL', weight: 2, shape: ['###', '#..', '#..'] },
  { id: 'BL4', group: 'bigL', weight: 2, shape: ['###', '..#', '..#'] },

  { id: 'T1', group: 'T', weight: 2, shape: ['###', '.#.'] },
  { id: 'T2', group: 'T', weight: 2, shape: ['.#.', '###'] },
  { id: 'T3', group: 'T', weight: 2, shape: ['#.', '##', '#.'] },
  { id: 'T4', group: 'T', weight: 2, shape: ['.#', '##', '.#'] },

  { id: 'S1', group: 'SZ', weight: 2, shape: ['.##', '##.'] },
  { id: 'S2', group: 'SZ', weight: 2, shape: ['#.', '##', '.#'] },
  { id: 'Z1', group: 'SZ', weight: 2, shape: ['##.', '.##'] },
  { id: 'Z2', group: 'SZ', weight: 2, shape: ['.#', '##', '#.'] },
];
