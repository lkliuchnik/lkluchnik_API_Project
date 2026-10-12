import { test, expect } from '../fixtures/api.fixture';
import { buildUser } from '../test-data/userFactory';
import { HttpStatus } from '../test-data/httpStatus';

test.describe('User data', () => {
  test('a new user created as admin gets the admin role', async ({ api }) => {
    const newAdmin = buildUser({ role: 'admin' }); // only the role matters here, the rest are defaults

    const { status, body: created } = await api.users.add(newAdmin);

    expect(status).toBe(HttpStatus.CREATED);
    expect(typeof created.id).toBe('number');
    expect(created.role).toBe('admin');
    expect(created.username).toBe(newAdmin.username);
  });

  // known deviation: DummyJSON does not save changes, see assertion-notes.txt
  test.fail('create a user, change it, and the change persists', async ({ api }) => {
    const newUser = buildUser();
    const newLastName = 'Changed';

    const { status: createStatus, body: created } = await api.users.add(newUser);
    expect(createStatus).toBe(HttpStatus.CREATED);
    expect(created.username).toBe(newUser.username);

    const { status: updateStatus } = await api.users.update(created.id, { lastName: newLastName });
    expect.soft(updateStatus).toBe(HttpStatus.OK);

    const { status: getStatus, body: saved } = await api.users.getById(created.id);
    expect(getStatus).toBe(HttpStatus.OK);
    expect(saved.lastName).toBe(newLastName);
    expect(saved.username).toBe(newUser.username);
  });

  // known deviation: the API accepts duplicates with 201, see assertion-notes.txt
  test.fail('creating a user with an existing username and email fails', async ({ api }) => {
    // take the username and email of a user that already exists
    const { status: existingStatus, body: existingUser } = await api.users.getById(1);
    expect(existingStatus, 'precondition: user 1 exists').toBe(HttpStatus.OK);
    const duplicate = buildUser({ username: existingUser.username, email: existingUser.email });

    const { status, body } = await api.users.add(duplicate);

    expect(status).toBe(HttpStatus.CONFLICT);
    expect(body.id).toBeUndefined();
  });
});
