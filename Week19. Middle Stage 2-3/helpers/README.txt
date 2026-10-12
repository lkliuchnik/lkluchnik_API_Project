README - API test architecture
==============================

How the tests in this folder are built, and how to extend them: a new test, a
new endpoint, a new service, a new environment, a new API.

Written for anyone who joins the project. You need to know Playwright and
TypeScript basics; everything else is explained here.


In short
--------

- A test never sends HTTP itself. It calls a service method, for example
  api.posts.getByUser(1).
- Services are thin: one method per endpoint. All the common work (base URL,
  token, logging, retries, reading the answer) is done once, in ApiClient and
  its interceptors.
- Settings that differ between environments live in config/environments.ts.
  Choose one with TEST_ENV - no code changes.
- To test a new endpoint you add one service method and one test.

Words like "interceptor", "fixture" or "seeded data" are explained in
test-plan.txt, part "Words used in these files".


Quick start
-----------

In this folder:

   npm ci                    install the packages (once)
   npx playwright test       run all tests in the dev environment
   npm run test:report       open the HTML report

More commands: part 11.


Contents
--------

   1. The layers
   2. Where things are
   3. ApiClient and the interceptors
   4. Environments
   5. Fixtures - what a test can ask for
   6. How to add a new test
   7. How to add a new endpoint to an existing service
   8. How to add a new service
   9. How to add a new environment
   10. How to add a new API
   11. How to run
   12. Rules we keep


1. The layers
-------------

   test                 what to check: the scenario and the expected values
     |
   fixture              what the test needs, ready to use: services, a token, data
     |
   service              which endpoint: api.posts.getByUser(1) -> GET /posts/user/1
     |
   ApiClient            how to send: base URL, headers, { status, ok, body, ... }
     |-- interceptors   added to every request: auth, retry, logging
     |
   HTTP (Playwright's request)

Each layer talks only to the one below it. A test does not know URLs; a
service does not know about retries; the client does not know what is a
"correct" answer.

Two named exceptions, on purpose: the smoke test calls the bare client
(GET /test), and the interceptor tests build their own small clients - they
test the client itself, so they need to see it.


2. Where things are
-------------------

   config/environments.ts      the environments (dev, staging) and their settings
   api/ApiClient.ts            the base client, shared by all APIs
   api/createApiClient.ts      builds a client the standard way (JSON headers,
                               retry, logging) - every API's fixture uses it
   api/interceptors/           auth.ts, retry.ts, logging.ts - shared by all APIs
   models/common.ts            ApiResponse<T> and other shapes all APIs share
   test-data/httpStatus.ts     status codes with names, shared

   One folder per API inside each layer:
   services/dummyjson/         AuthService, ProductService, UserService,
                               CartService, PostService, CommentService,
                               DummyJsonSession (logs in, for the auth interceptor)
   models/dummyjson/           interfaces of what we send and get back
   test-data/dummyjson/        factories (buildUser, buildProduct), constants
   assertions/dummyjson/       checks shared by several tests (cart totals)
   tests/dummyjson/            the tests

   fixtures/base.fixture.ts       shared by all APIs: env, the request log
   fixtures/dummyjson.fixture.ts  the DummyJSON services and data


3. ApiClient and the interceptors
---------------------------------

ApiClient sends a request and always gives back the same shape:

   { status, ok, body, durationMs, attempts }

It never throws because of a status: a 401 comes back like a 200, because
negative tests need to see it. It throws only when the server does not answer
at all. An answer that is not JSON is kept as text in body.message.

Headers: createApiClient gives every client the JSON headers
(Content-Type and Accept). A request can add its own with "headers", and
"token" becomes "Authorization: Bearer <token>". The headers are not set in
playwright.config.ts on purpose - there they would also go to the browser
pages of UI tests.

About the body type: body has the shape of a successful answer. On an error
answer only body.message is really there - so check the status first. We
keep it this simple on purpose: a strict "data or error" type would make
every negative test longer.

An interceptor is a small function that every request passes through. It can
change the request, send it again, or write something down. The client runs
them in the order they are given; the first one sees the request first.

auth (api/interceptors/auth.ts)
   Adds "Authorization: Bearer <token>" when the request has no token.
   If the server answers 401, it gets a new token once and tries again.
   If no new token can be got, the test gets that 401 - not an exception.
   A request that brings its own token - even a wrong one - is left alone,
   so tests about tokens keep full control.
   Where the token comes from is given by the API: a TokenSource. For
   DummyJSON it is DummyJsonSession: it logs in on the first request, uses
   /auth/refresh after a 401 (and logs in again if that fails), and never
   logs in twice when two requests ask at the same time.

retry (api/interceptors/retry.ts)
   Sends a GET again when the server is briefly unavailable: an answer 502,
   503 or 504, or no answer at all (timeout, connection error).
   Not repeated: POST, PUT, DELETE (could change data twice), 500 (usually a
   bug that answers the same way every time), 4xx (would fail the same way).
   How many times: http.retries in the environment.

logging (api/interceptors/logging.ts)
   Writes one line per real request, for example
      GET /auth/me -> 401 (212 ms) [token]
   The lines are attached to the HTML report of each test as "api-log".
   On or off: http.logRequests in the environment.


4. Environments
---------------

config/environments.ts has one block per environment:

   dev       user emilys,   no retries,  timeout 10 s
   staging   user michaelw, 2 retries,   timeout 15 s

Request logging is on in both, so a retry in staging is visible in the
report.

Choose one when you run the tests:

   TEST_ENV=staging npx playwright test        (dev is the default)

One value can be changed without touching the file, with a variable in .env
or in CI: DUMMYJSON_URL, DUMMYJSON_USERNAME, DUMMYJSON_PASSWORD.

A wrong name stops the run with a clear message:
   Unknown TEST_ENV "prod". Use one of: dev, staging

Note: DummyJSON has only one public server, so both environments use the
same address. They show the mechanism: another user, other HTTP settings,
the same code. A real project would put another base URL here.

CI runs every test in both environments (a matrix in
.github/workflows/week19-middle2-3.yml).


5. Fixtures - what a test can ask for
-------------------------------------

From fixtures/base.fixture.ts (every API):
   env          the settings of the chosen environment
   apiLog       the request log; filled by the logging interceptor and
                attached to the report after each test (an automatic hook)

From fixtures/dummyjson.fixture.ts:
   api                services WITHOUT login - a request has a token only if the
                      test passes one. Use it for negative and token tests.
   authApi            the same services WITH the auth interceptor - every request
                      is logged in as the environment's user. Use it by default
                      for endpoints that need a login.
   authToken          a fresh token, for tests that pass a token by hand
   session            the login behind authApi (to build special clients)
   apiClient          the bare client, for the smoke test
   postWithComments   existing data that fits the test: a post that has comments,
                      found through the API before the test (DummyJSON does not
                      save new data, so we look up data instead of creating it)

Which one do I use?
   The endpoint needs a login, the test is not about tokens  -> authApi
   The test is about tokens (none, wrong, forged)            -> api + authToken
   The endpoint needs no login                               -> api
   The test is about the client or an interceptor itself     -> build a small
                                                                ApiClient in the
                                                                test (see
                                                                interceptors.spec.ts)


6. How to add a new test
------------------------

1. Put it in tests/<api>/, next to tests about the same resource.
2. Import test and expect from the fixture file of that API:
      import { test, expect } from '../../fixtures/dummyjson.fixture';
      import { HttpStatus } from '../../test-data/httpStatus';
3. Ask for what you need and call services:

      test('all posts of the logged-in user belong to that user', async ({ authApi }) => {
        const { body: me } = await authApi.auth.getCurrentUser();
        const { status, body } = await authApi.posts.getByUser(me.id);
        expect(status).toBe(HttpStatus.OK);
        ...
      });

4. Keep the expected values in the test (see "Rules we keep").


7. How to add a new endpoint to an existing service
---------------------------------------------------

This is how product search was added: GET /products/search?q=<word>.

1. If the answer has a new shape, add an interface in models/dummyjson/.
   Here the shape exists already (ProductsPage), so nothing to add.
2. Add one method to the service (services/dummyjson/ProductService.ts):

      search(query: string) {
        return this.client.get<ProductsPage>('/products/search', { params: { q: query } });
      }

3. Write the test (tests/dummyjson/productSearch.spec.ts).

Nothing else changes - api.products.search() exists in every test at once.


8. How to add a new service
---------------------------

This is how PostService and CommentService were added.

1. Model - models/dummyjson/post.ts:
   interfaces for what the endpoint returns (Post, PostsPage) and what you
   send (NewPost). Only the fields the tests use.

2. Service - services/dummyjson/PostService.ts:

      export class PostService {
        constructor(private readonly client: ApiClient) {}

        getById(id: number) {
          return this.client.get<Post>(`/posts/${id}`);
        }
      }

   One method per endpoint. No expect(), no URLs outside the service, no
   token handling (the client and the interceptors do that).

3. Register it - one line in servicesFor() in fixtures/dummyjson.fixture.ts:
      posts: new PostService(client),
   The DummyJsonApi type is built from servicesFor(), so it follows by itself.
   From now on api.posts and authApi.posts exist in every test.

4. Test - tests/dummyjson/posts.spec.ts.

Not needed: changes in ApiClient, the interceptors, the config, the other
services or the other tests.


9. How to add a new environment
-------------------------------

1. Add a name to EnvironmentName in config/environments.ts.
2. Add its block to the environments list.
3. Run with TEST_ENV=<name>. In CI, add the name to the matrix.


10. How to add a new API
------------------------

(This is how DemoQA BookStore is added in Middle Stage 3.)

1. Config (config/environments.ts): add a block for the new API (base URL,
   test user) to the Environment type and to each environment. If its values
   should be changeable from .env or CI, add those lines to
   loadEnvironment(), like the DUMMYJSON_* ones.
2. Folders: services/<api>/, models/<api>/, tests/<api>/, test-data/<api>/.
3. If the API needs a login: a small class that implements TokenSource
   (getToken, refresh), like DummyJsonSession.
4. Fixture file fixtures/<api>.fixture.ts that extends base.fixture.ts and
   builds its services on createApiClient(...) - so it gets the same headers,
   retries and logging as every other API.

ApiClient, createApiClient and the interceptors stay as they are. An API
that needs another kind of login header (an API key, a cookie) can send it
with "headers" from its own interceptor.


11. How to run
--------------

In this folder:

   npm ci                                install the packages
   npx tsc --noEmit                      check the types
   npx playwright test                   all tests, environment dev
   TEST_ENV=staging npx playwright test  all tests, environment staging
   npx playwright test tests/dummyjson/posts.spec.ts     one file
   npm run test:report                   open the HTML report

On Windows PowerShell: $env:TEST_ENV="staging"; npx playwright test


12. Rules we keep
-----------------

- Tests do not build URLs or headers (exceptions: the smoke test and the
  interceptor tests, see part 1). Services do not use expect(). The client
  does not decide what is right or wrong.
- Expected values stay in the test (messages, numbers). A helper that also
  checks the status would hide the most important line.
- Pass a token by hand (api + authToken) only when the test is about tokens;
  otherwise use authApi.
- A test that fails because the API does not do what the task asks is
  declared as test.fail('title', ...), with a one-line comment above it.
  Never test.fail() inside the test.
- Only add a shared helper when it is a real rule used by several tests
  (like the cart totals). Two similar lines are not a reason for a helper.
