import { test, expect } from '../../fixtures/bookstore.fixture';
import { HttpStatus } from '../../test-data/httpStatus';

// Scenarios from the coverage gap analysis (helpers/coverage-gaps.txt): how DemoQA handles
// tokens and passwords.
test.describe('Tokens and passwords', () => {
  // gap S2 - this rule also explains why API calls after a UI login fail (helpers/ai-review.txt)
  test('only the newest token of an account works: a new login ends the old token', async ({
    reader,
    bookstore,
  }) => {
    const { body: first } = await bookstore.account.generateToken(reader);
    const { body: second } = await bookstore.account.generateToken(reader);
    expect(first.status, 'precondition: first login').toBe('Success');
    expect(second.status, 'precondition: second login').toBe('Success');
    expect(second.token).not.toBe(first.token);

    const { status: oldStatus, body: oldBody } = await bookstore.account.getUser(reader.userId, first.token!);
    expect(oldStatus).toBe(HttpStatus.UNAUTHORIZED);
    expect(oldBody.message).toBe('User not authorized!');

    const { status: newStatus } = await bookstore.account.getUser(reader.userId, second.token!);
    expect(newStatus).toBe(HttpStatus.OK);
  });

  // gap S10. known deviation: the password is sent back, see assertion-notes.txt
  test.fail('the password is never sent back - not inside the token, not in the Login answer', async ({
    reader,
    bookstore,
  }) => {
    const { body: tokenAnswer } = await bookstore.account.generateToken(reader);
    expect(tokenAnswer.status, 'precondition: login').toBe('Success');

    // a JWT is three base64 parts; the middle one (payload) can be read by anyone who has the token
    const payload = JSON.parse(Buffer.from(tokenAnswer.token!.split('.')[1], 'base64url').toString());
    expect.soft(payload, 'token payload').not.toHaveProperty('password');

    const { body: login } = await bookstore.account.login(reader);
    expect.soft(JSON.stringify(login), 'Login answer').not.toContain(reader.password);
  });
});
