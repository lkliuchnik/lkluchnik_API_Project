import { test, expect } from '@playwright/test';
import { addUser, getUser, updateUser } from '../helpers/dummyApi';
import { buildUser } from '../test-data/userFactory';
import { HttpStatus } from '../test-data/httpStatus';

test.describe('User data', () => {
  test('create a user, change it, and the change persists', async ({ request }) => {
    test.fail(); // known deviation: DummyJSON does not save changes, see assertion-notes.txt

    const newUser = buildUser();

    const { status: createStatus, body: created } = await addUser(request, newUser);
    expect(createStatus).toBe(HttpStatus.CREATED);
    expect(created.username).toBe(newUser.username);

    const { status: updateStatus } = await updateUser(request, created.id, { lastName: 'Changed' });
    expect.soft(updateStatus).toBe(HttpStatus.OK);

    const { status: getStatus, body: saved } = await getUser(request, created.id);
    expect(getStatus).toBe(HttpStatus.OK);
    expect(saved.lastName).toBe('Changed');
    expect(saved.username).toBe(newUser.username);
  });

  test('creating a user with an existing username and email fails', async ({ request }) => {
    test.fail(); // known deviation: the API accepts duplicates with 201, see assertion-notes.txt

    // take the username and email of a user that already exists
    const { body: existingUser } = await getUser(request, 1);
    const duplicate = buildUser({ username: existingUser.username, email: existingUser.email });

    const { status, body } = await addUser(request, duplicate);

    expect(status).toBe(HttpStatus.CONFLICT);
    expect(body.id).toBeUndefined();
  });
});
