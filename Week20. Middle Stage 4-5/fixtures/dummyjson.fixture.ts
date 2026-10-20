import { test as base, expect } from './base.fixture';
import { ApiClient } from '../api/ApiClient';
import { createApiClient } from '../api/createApiClient';
import { authInterceptor } from '../api/interceptors/auth';
import { AuthService } from '../services/dummyjson/AuthService';
import { CartService } from '../services/dummyjson/CartService';
import { CommentService } from '../services/dummyjson/CommentService';
import { DummyJsonSession } from '../services/dummyjson/DummyJsonSession';
import { PostService } from '../services/dummyjson/PostService';
import { ProductService } from '../services/dummyjson/ProductService';
import { UserService } from '../services/dummyjson/UserService';
import { Comment } from '../models/dummyjson/comment';
import { Post } from '../models/dummyjson/post';
import { HttpStatus } from '../test-data/httpStatus';

// All DummyJSON services on one client. A new service is added here - one line.
function servicesFor(client: ApiClient) {
  return {
    auth: new AuthService(client),
    products: new ProductService(client),
    users: new UserService(client),
    carts: new CartService(client),
    posts: new PostService(client),
    comments: new CommentService(client),
  };
}

export type DummyJsonApi = ReturnType<typeof servicesFor>;

type DummyJsonFixtures = {
  apiClient: ApiClient; // client without auth - for the smoke test
  api: DummyJsonApi; // services without auth: a request has a token only if the test passes one
  session: DummyJsonSession; // logs in as the environment's test user
  authApi: DummyJsonApi; // services with the auth interceptor: every request is logged in
  authToken: string; // a fresh token, for tests that pass it by hand
  postWithComments: { post: Post; comments: Comment[] }; // existing data, found before the test
};

export const test = base.extend<DummyJsonFixtures>({
  apiClient: async ({ request, env, apiLog }, use) => {
    await use(createApiClient(request, { baseUrl: env.dummyjson.baseUrl, http: env.http, log: apiLog }));
  },

  api: async ({ apiClient }, use) => {
    await use(servicesFor(apiClient));
  },

  session: async ({ api, env }, use) => {
    await use(new DummyJsonSession(api.auth, env.dummyjson));
  },

  authApi: async ({ request, env, apiLog, session }, use) => {
    const client = createApiClient(request, {
      baseUrl: env.dummyjson.baseUrl,
      http: env.http,
      log: apiLog,
      auth: authInterceptor(session),
    });
    await use(servicesFor(client));
  },

  authToken: async ({ session }, use) => {
    await use(await session.getToken());
  },

  // "Seeded" data: DummyJSON does not save new data, so the test gets existing data that
  // fits - a post that has comments - found through the API, not typed in.
  postWithComments: async ({ api }, use) => {
    const { status, body: page } = await api.comments.getPage(1, 0);
    expect(status, 'precondition: GET /comments').toBe(HttpStatus.OK);
    expect(page.comments.length, 'precondition: there is at least one comment').toBeGreaterThan(0);
    const postId = page.comments[0].postId;

    const { status: postStatus, body: post } = await api.posts.getById(postId);
    expect(postStatus, `precondition: GET /posts/${postId}`).toBe(HttpStatus.OK);

    const { status: commentsStatus, body: comments } = await api.comments.getByPost(postId);
    expect(commentsStatus, `precondition: GET /comments/post/${postId}`).toBe(HttpStatus.OK);

    await use({ post, comments: comments.comments });
  },
});

export { expect };
