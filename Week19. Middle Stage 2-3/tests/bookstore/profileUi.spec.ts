import { test, expect } from '../../fixtures/bookstore.fixture';
import { LoginPage } from '../../pages/bookstore/LoginPage';
import { ProfilePage } from '../../pages/bookstore/ProfilePage';
import { HttpStatus } from '../../test-data/httpStatus';

// API + UI: the data is prepared through the API (fast, exact, no clicking through the
// store), and the UI is checked the way a reader sees it. Why both: helpers/modality.txt.
// Order matters: API setup first, UI login second - a UI login replaces the account's token.
test('books added through the API are shown on the reader profile after a UI login', { tag: '@ui' }, async ({
  reader,
  readerApi,
  catalog,
  page,
  env,
}) => {
  const [first, second] = catalog;

  await test.step('API: put two books into the new reader collection', async () => {
    const { status } = await readerApi.books.addBooks(reader.userId, [first.isbn, second.isbn]);
    expect(status, 'precondition: books added').toBe(HttpStatus.CREATED);
  });

  await test.step('UI: log in like a reader', async () => {
    const login = new LoginPage(page, env.bookstore.baseUrl);
    await login.open();
    await login.logIn(reader);
  });

  await test.step('UI: the profile shows the reader name and exactly these two books', async () => {
    const profile = new ProfilePage(page);
    await expect(profile.userName).toHaveText(reader.userName);
    await expect(profile.bookLinks).toHaveText([first.title, second.title]);
  });
});
