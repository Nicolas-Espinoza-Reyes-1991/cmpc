import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import type { BookDto } from './dto/book.dto';
import type { CreateBookDto } from './dto/create-book.dto';
import { ListBooksQueryDto } from './dto/list-books-query.dto';

const ID = '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11';
const book = { id: ID, title: 'Dune' } as BookDto;
const ACTOR = { userId: 'user-1', ip: '203.0.113.7' };

describe('BooksController', () => {
  const create = jest.fn();
  const findOne = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();
  const findAll = jest.fn();
  const setImage = jest.fn();
  const removeImage = jest.fn();
  let controller: BooksController;

  beforeEach(async () => {
    create.mockReset().mockResolvedValue(book);
    findOne.mockReset().mockResolvedValue(book);
    update.mockReset().mockResolvedValue(book);
    remove.mockReset().mockResolvedValue(undefined);
    setImage.mockReset().mockResolvedValue(book);
    removeImage.mockReset().mockResolvedValue(book);
    findAll.mockReset().mockResolvedValue({
      items: [book],
      meta: { page: 1, limit: 10, total: 1 },
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        {
          provide: BooksService,
          useValue: {
            create,
            findOne,
            update,
            remove,
            findAll,
            setImage,
            removeImage,
          },
        },
      ],
    }).compile();
    controller = moduleRef.get(BooksController);
  });

  it('create passes the body and the actor to the service', async () => {
    const dto = { title: 'Dune' } as CreateBookDto;

    await expect(controller.create(dto, ACTOR)).resolves.toBe(book);
    expect(create).toHaveBeenCalledWith(dto, ACTOR);
  });

  it('list passes the query to the service and returns its page', async () => {
    const query = Object.assign(new ListBooksQueryDto(), { search: 'dune' });

    await expect(controller.list(query)).resolves.toEqual({
      items: [book],
      meta: { page: 1, limit: 10, total: 1 },
    });
    expect(findAll).toHaveBeenCalledWith(query);
  });

  it('findOne passes the id to the service', async () => {
    await expect(controller.findOne(ID)).resolves.toBe(book);
    expect(findOne).toHaveBeenCalledWith(ID);
  });

  it('update passes the id and the changes to the service', async () => {
    await expect(controller.update(ID, { price: 10 }, ACTOR)).resolves.toBe(
      book,
    );
    expect(update).toHaveBeenCalledWith(ID, { price: 10 }, ACTOR);
  });

  it('remove passes the id to the service and returns nothing', async () => {
    await expect(controller.remove(ID, ACTOR)).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith(ID, ACTOR);
  });

  it('uploadImage passes the id and the file to the service', async () => {
    const file = { buffer: Buffer.from('x') };

    await expect(controller.uploadImage(ID, file, ACTOR)).resolves.toBe(book);
    expect(setImage).toHaveBeenCalledWith(ID, file, ACTOR);
  });

  it('uploadImage answers 400 when there is no file, without calling the service', () => {
    expect(() => controller.uploadImage(ID, undefined, ACTOR)).toThrow(
      BadRequestException,
    );
    expect(() => controller.uploadImage(ID, undefined, ACTOR)).toThrow(
      'field "image"',
    );
    expect(setImage).not.toHaveBeenCalled();
  });

  it('removeImage passes the id to the service', async () => {
    await expect(controller.removeImage(ID, ACTOR)).resolves.toBe(book);
    expect(removeImage).toHaveBeenCalledWith(ID, ACTOR);
  });

  it('lets service errors propagate to the global filter', async () => {
    const failure = new Error('boom');
    findOne.mockRejectedValue(failure);

    await expect(controller.findOne(ID)).rejects.toBe(failure);
  });
});
