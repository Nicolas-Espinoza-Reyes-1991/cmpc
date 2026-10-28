import {
  applySoftDelete,
  softDeleteExtension,
  withActiveFilter,
} from './soft-delete.extension';

describe('withActiveFilter', () => {
  it('adds deletedAt: null to an empty condition', () => {
    expect(withActiveFilter(undefined)).toEqual({ deletedAt: null });
    expect(withActiveFilter({})).toEqual({ deletedAt: null });
  });

  it('keeps the rest of the condition', () => {
    expect(withActiveFilter({ id: 'b1', OR: [{ title: 'x' }] })).toEqual({
      id: 'b1',
      OR: [{ title: 'x' }],
      deletedAt: null,
    });
  });

  it('respects a condition that already mentions deletedAt', () => {
    const deleted = { deletedAt: { not: null } };

    expect(withActiveFilter(deleted)).toBe(deleted);
    expect(withActiveFilter({ deletedAt: null })).toEqual({ deletedAt: null });
  });
});

describe('applySoftDelete', () => {
  const query = jest.fn<Promise<unknown>, [object]>();

  beforeEach(() => {
    query.mockReset().mockResolvedValue('result');
  });

  it.each([
    'findFirst',
    'findFirstOrThrow',
    'findMany',
    'findUnique',
    'findUniqueOrThrow',
    'count',
    'aggregate',
    'groupBy',
    'update',
    'updateMany',
    'delete',
    'deleteMany',
  ])('only sees active books in %s', async (operation) => {
    const result = await applySoftDelete(
      operation,
      { where: { id: 'b1' }, select: { id: true } },
      query,
    );

    expect(result).toBe('result');
    expect(query).toHaveBeenCalledWith({
      where: { id: 'b1', deletedAt: null },
      select: { id: true },
    });
  });

  it('filters a call that has no where at all', async () => {
    await applySoftDelete('findMany', {}, query);

    expect(query).toHaveBeenCalledWith({ where: { deletedAt: null } });
  });

  it.each(['create', 'createMany', 'upsert'])(
    'leaves %s untouched',
    async (operation) => {
      const args = { data: { title: 'x' } };

      await applySoftDelete(operation, args, query);

      expect(query).toHaveBeenCalledWith(args);
    },
  );

  it('lets a query ask for deleted books explicitly', async () => {
    await applySoftDelete(
      'findMany',
      { where: { deletedAt: { not: null } } },
      query,
    );

    expect(query).toHaveBeenCalledWith({
      where: { deletedAt: { not: null } },
    });
  });
});

/** The part of the extension definition this test calls. */
interface CapturedDefinition {
  query: {
    book: {
      $allOperations: (context: {
        operation: string;
        args: object;
        query: (args: object) => Promise<unknown>;
      }) => Promise<unknown>;
    };
  };
}

describe('softDeleteExtension', () => {
  it('applies the filter to every book operation it is registered for', async () => {
    // Registering an extension just hands its definition to `$extends`; the fake
    // client returns it so the test can call the handler directly.
    const client = { $extends: (definition: unknown) => definition };
    // `as unknown as`: the fake has only `$extends` (the one member `defineExtension` uses) and the real return type is a Prisma client, not the definition.
    const definition = softDeleteExtension(
      client,
    ) as unknown as CapturedDefinition;
    const query = jest.fn().mockResolvedValue('rows');

    const result = await definition.query.book.$allOperations({
      operation: 'findMany',
      args: { where: { title: 'x' } },
      query,
    });

    expect(result).toBe('rows');
    expect(query).toHaveBeenCalledWith({
      where: { title: 'x', deletedAt: null },
    });
  });
});
