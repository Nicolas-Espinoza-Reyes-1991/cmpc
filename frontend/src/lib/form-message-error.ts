/**
 * An error whose message is already written for the user and must be shown as
 * it is (for example "the data was saved, but the cover could not be uploaded").
 * The forms show any other error with the generic message of its status.
 */
export class FormMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormMessageError';
  }
}
