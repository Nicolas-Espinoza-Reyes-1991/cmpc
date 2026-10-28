import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { currentUserFactory } from './current-user.decorator';

describe('currentUserFactory', () => {
  it('returns the user attached to the request by the JWT strategy', () => {
    const user = { id: 'user-1', email: 'admin@cmpc.local' };
    const context = new ExecutionContextHost([{ user }]);

    expect(currentUserFactory(undefined, context)).toBe(user);
  });

  it('returns undefined on a request without user (public routes)', () => {
    const context = new ExecutionContextHost([{}]);

    expect(currentUserFactory(undefined, context)).toBeUndefined();
  });
});
