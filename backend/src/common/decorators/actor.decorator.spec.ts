import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { actorFactory } from './actor.decorator';

describe('actorFactory', () => {
  it('takes the user from the verified token and the ip from the connection', () => {
    const context = new ExecutionContextHost([
      { user: { id: 'user-1', email: 'a@b.c' }, ip: '203.0.113.7' },
    ]);

    expect(actorFactory(undefined, context)).toEqual({
      userId: 'user-1',
      ip: '203.0.113.7',
    });
  });

  it('has no user on a public route', () => {
    const context = new ExecutionContextHost([{ ip: '203.0.113.7' }]);

    expect(actorFactory(undefined, context)).toEqual({
      userId: null,
      ip: '203.0.113.7',
    });
  });

  it('has no ip when the request does not carry one', () => {
    const context = new ExecutionContextHost([{}]);

    expect(actorFactory(undefined, context)).toEqual({
      userId: null,
      ip: null,
    });
  });

  it('ignores a user id or ip sent by the client in the body or headers', () => {
    const context = new ExecutionContextHost([
      {
        body: { userId: 'attacker', ip: '6.6.6.6' },
        headers: { 'x-user-id': 'attacker' },
      },
    ]);

    expect(actorFactory(undefined, context)).toEqual({
      userId: null,
      ip: null,
    });
  });
});
