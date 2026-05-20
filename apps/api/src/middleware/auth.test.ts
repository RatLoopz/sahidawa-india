import assert from 'node:assert/strict';
import { NextFunction, Response } from 'express';
import { AuthenticatedRequest, createAuthMiddleware, requireRole } from './auth';

const createResponse = () => {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  return res as Response & { statusCode: number; body: unknown };
};

const createClient = (user: unknown, error: unknown = null) => ({
  auth: {
    getUser: async (token: string) => ({
      data: { user },
      error,
      token,
    }),
  },
});

describe('auth middleware', () => {
  it('rejects requests without an access_token cookie', async () => {
    const req = { cookies: {} } as unknown as AuthenticatedRequest;
    const res = createResponse();
    let nextCalled = false;

    await createAuthMiddleware(createClient(null) as never)(req, res, (() => {
      nextCalled = true;
    }) as NextFunction);

    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'Authorization bearer token is required' });
    assert.equal(nextCalled, false);
  });

  it('rejects invalid Supabase tokens from cookie', async () => {
    const req = { cookies: { access_token: 'invalid-token' } } as unknown as AuthenticatedRequest;
    const res = createResponse();

    await createAuthMiddleware(createClient(null, new Error('invalid')) as never)(
      req,
      res,
      (() => {
        assert.fail('next should not be called');
      }) as NextFunction,
    );

    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'Invalid or expired authentication token' });
  });

  it('attaches authenticated user details for valid access_token cookie', async () => {
    const req = { cookies: { access_token: 'valid-token' } } as unknown as AuthenticatedRequest;
    const res = createResponse();
    let nextCalled = false;

    await createAuthMiddleware(
      createClient({
        id: 'user-1',
        email: 'user@example.com',
        app_metadata: {},
        user_metadata: {},
      }) as never,
    )(req, res, (() => {
      nextCalled = true;
    }) as NextFunction);

    assert.equal(nextCalled, true);
    assert.equal(req.user?.id, 'user-1');
    assert.equal(req.user?.email, 'user@example.com');
    assert.equal(req.user?.role, 'user');
  });

  it('allows admin-only handlers for admin users', () => {
    const req = { user: { role: 'admin' } } as unknown as AuthenticatedRequest;
    const res = createResponse();
    let nextCalled = false;

    requireRole('admin')(req, res, (() => {
      nextCalled = true;
    }) as NextFunction);

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  });

  it('rejects user role requests for admin-only handlers', () => {
    const req = { user: { role: 'user' } } as unknown as AuthenticatedRequest;
    const res = createResponse();

    requireRole('admin')(req, res, (() => {
      assert.fail('next should not be called');
    }) as NextFunction);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'Insufficient permissions' });
  });
});
