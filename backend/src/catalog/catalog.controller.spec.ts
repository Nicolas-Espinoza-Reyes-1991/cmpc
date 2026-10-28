import { Test } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

describe('CatalogController', () => {
  const list = jest.fn();
  let controller: CatalogController;

  beforeEach(async () => {
    list.mockReset().mockResolvedValue([{ id: 'c1', name: 'Planeta' }]);
    const moduleRef = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [{ provide: CatalogService, useValue: { list } }],
    }).compile();
    controller = moduleRef.get(CatalogController);
  });

  it.each([
    ['authors', 'author'],
    ['publishers', 'publisher'],
    ['genres', 'genre'],
  ] as const)(
    '%s delegates to the service with kind %s',
    async (route, kind) => {
      const query = { search: 'p', limit: 10 };

      const result = await controller[route](query);

      expect(result).toEqual([{ id: 'c1', name: 'Planeta' }]);
      expect(list).toHaveBeenCalledWith(kind, query);
    },
  );
});
