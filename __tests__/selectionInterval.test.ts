import { expandSelectionInterval } from '../src/core/selectionInterval';
const rows=['a','b','c','d','e'];
test('fills every visible item between first and last selection',()=>{expect([...expandSelectionInterval(rows,new Set(['b','e']),item=>item)]).toEqual(['b','e','c','d'])});
test('preserves off-list selections and handles empty selection',()=>{expect([...expandSelectionInterval(rows,new Set(['outside','c']),item=>item)]).toEqual(['outside','c']);expect([...expandSelectionInterval(rows,new Set(),item=>item)]).toEqual([])});
