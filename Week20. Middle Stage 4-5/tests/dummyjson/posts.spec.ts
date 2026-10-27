import { test, expect } from '../../fixtures/dummyjson.fixture';
import { HttpStatus } from '../../test-data/httpStatus';
import { NON_EXISTENT_ID } from '../../test-data/dummyjson/constants';
import { Tag } from '../../config/tags';

// Written with the new PostService only - no change in the client, the interceptors or the
// config was needed. See helpers/README.txt, "How to add a new service".
test.describe('Posts', { tag: Tag.REGRESSION }, () => {
  test('all posts of the logged-in user belong to that user', async ({ authApi }) => {
    const { status: meStatus, body: me } = await authApi.auth.getCurrentUser();
    expect(meStatus, 'precondition: GET /auth/me').toBe(HttpStatus.OK);

    const { status, body } = await authApi.posts.getByUser(me.id);

    expect(status).toBe(HttpStatus.OK);
    expect(body.posts.length).toBeGreaterThan(0);
    expect(body.total).toBe(body.posts.length);
    for (const post of body.posts) {
      expect(post.userId).toBe(me.id);
    }
  });

  test('a new post keeps its title, text and author', async ({ authApi }) => {
    const { body: me } = await authApi.auth.getCurrentUser();
    const newPost = { title: 'QA post', body: 'Written by an API test.', userId: me.id };

    const { status, body } = await authApi.posts.add(newPost);

    expect(status).toBe(HttpStatus.CREATED);
    expect(typeof body.id).toBe('number');
    expect(body.title).toBe(newPost.title);
    expect(body.body).toBe(newPost.body);
    expect(body.userId).toBe(me.id);
  });

  test('a post for a user that does not exist is rejected', async ({ api }) => {
    const { status, body } = await api.posts.add({ title: 'QA post', body: 'No author.', userId: NON_EXISTENT_ID });

    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect(body.message).toBe(`User with id '${NON_EXISTENT_ID}' not found`);
  });
});
