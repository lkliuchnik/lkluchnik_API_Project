import { test, expect } from '../../fixtures/dummyjson.fixture';
import { HttpStatus } from '../../test-data/httpStatus';
import { NON_EXISTENT_ID } from '../../test-data/dummyjson/constants';

// Written with the new CommentService only, plus the postWithComments fixture (existing data
// found before the test).
test.describe('Comments', () => {
  test('every comment of a post points to that post', async ({ postWithComments }) => {
    const { post, comments } = postWithComments;

    expect(comments.length).toBeGreaterThan(0);
    for (const comment of comments) {
      expect(comment.postId).toBe(post.id);
    }
  });

  test('a new comment is saved under the given post and author', async ({ authApi, postWithComments }) => {
    const { body: me } = await authApi.auth.getCurrentUser();
    const newComment = { body: 'Useful post!', postId: postWithComments.post.id, userId: me.id };

    const { status, body } = await authApi.comments.add(newComment);

    expect(status).toBe(HttpStatus.CREATED);
    expect(body.body).toBe(newComment.body);
    expect(body.postId).toBe(postWithComments.post.id);
    expect(body.user.id).toBe(me.id);
    expect(body.user.username).toBe(me.username); // the author's name comes from the user id
  });

  test('a comment on a post that does not exist is rejected', async ({ api }) => {
    const { status, body } = await api.comments.add({ body: 'Lost comment', postId: NON_EXISTENT_ID, userId: 1 });

    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect(body.message).toBe(`Post with id '${NON_EXISTENT_ID}' not found`);
  });
});
