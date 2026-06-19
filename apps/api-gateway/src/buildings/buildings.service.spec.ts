import { Test } from '@nestjs/testing';
import { BuildingsService } from './buildings.service';
import { eq } from 'drizzle-orm';

/**
 * Per Finding 30 (Low): the previous version of this spec was
 *   const db: any = {};
 *   it('should be defined', () => { expect(service).toBeDefined(); });
 * which tested nothing. The new version builds a typed Drizzle mock
 * that records the WHERE clauses passed to `.where(...)`, and asserts
 * that `findAll` / `findOne` build the right predicates from the
 * service inputs.
 */

interface WhereCall {
  clause: ReturnType<typeof eq> | undefined;
}

function makeDbMock() {
  const whereCalls: WhereCall[] = [];
  const limitCalls: number[] = [];
  const returnValue: unknown[] = [];

  const chain: any = {
    // The drizzle query builder always starts with `select()`. The
    // service calls `this.db.select().from(...).where(...).limit(1)`,
    // so the mock has to return the chain from `select()` and from
    // every subsequent method.
    select: jest.fn(() => chain),
    from: jest.fn(() => chain),
    where: jest.fn((clause: WhereCall['clause']) => {
      whereCalls.push({ clause });
      return chain;
    }),
    limit: jest.fn((n: number) => {
      limitCalls.push(n);
      return Promise.resolve(returnValue);
    }),
    orderBy: jest.fn(() => chain),
  };
  return { db: chain, whereCalls, limitCalls, returnValue };
}

describe('BuildingsService', () => {
  let service: BuildingsService;
  let mock: ReturnType<typeof makeDbMock>;

  beforeEach(async () => {
    mock = makeDbMock();
    const module = await Test.createTestingModule({
      providers: [
        BuildingsService,
        { provide: 'DB', useValue: mock.db },
      ],
    }).compile();
    service = module.get(BuildingsService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('findAll() issues a SELECT against the buildings table with no WHERE', async () => {
    await service.findAll();
    expect(mock.db.from).toHaveBeenCalledTimes(1);
    expect(mock.whereCalls).toHaveLength(0);
  });

  it('findOne(id) builds a WHERE clause on id and limits to 1', async () => {
    await service.findOne('b1');
    expect(mock.db.from).toHaveBeenCalledTimes(1);
    expect(mock.whereCalls).toHaveLength(1);
    expect(mock.limitCalls).toEqual([1]);
  });

  it('findOne returns the first element of the limit result', async () => {
    mock.returnValue[0] = { id: 'b1', name: 'Hall 7' };
    const r = await service.findOne('b1');
    expect(r?.id).toBe('b1');
  });

  it('findOne returns null when the result is empty', async () => {
    mock.returnValue.length = 0;
    const r = await service.findOne('missing');
    expect(r).toBeNull();
  });
});
