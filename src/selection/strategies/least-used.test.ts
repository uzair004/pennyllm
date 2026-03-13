import { describe, it } from 'vitest';

describe('LeastUsedStrategy', () => {
  it.todo('selects key with highest worst-case remaining percentage');
  it.todo('treats keys with no limits as 100% remaining');
  it.todo('uses config order as tiebreaker when remaining is equal');
  it.todo('skips ineligible candidates');
});
