import { PartialType } from '@nestjs/swagger';
import { CreateBookDto } from './create-book.dto';

/**
 * Any subset of the creation fields. It inherits their validation and Swagger
 * description; an empty body is rejected by the service (C4.2).
 */
export class UpdateBookDto extends PartialType(CreateBookDto) {}
