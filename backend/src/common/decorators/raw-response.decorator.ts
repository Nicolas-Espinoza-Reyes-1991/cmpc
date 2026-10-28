import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'rawResponse';

/**
 * Opts a handler (or a whole controller) out of the `{ data }` envelope.
 * Use it for file downloads such as the CSV export or images (R5.3).
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
