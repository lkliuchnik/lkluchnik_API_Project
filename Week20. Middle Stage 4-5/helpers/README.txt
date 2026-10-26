README - API test architecture
==============================

What this file is for: how the tests in this folder are built, and how to extend them -
a new test, a new endpoint, a new service, a new environment, a new API.

Written for anyone who joins the project. You need to know Playwright and TypeScript
basics; everything else is explained here. Words like "interceptor", "fixture" or
"boundary value" are explained in test-plan.txt, part "Words used in these files".


In short
--------

- A test never sends HTTP itself. It calls a service method, for example
  petstore.pets.get(id).
- Services are thin: one method per endpoint. All the common work (base URL, token,
  logging, retries, reading the answer) is done once, in ApiClient and its interceptors.
- Settings that differ between environments live in config/environments.ts. Choose one
  with TEST_ENV - no code changes.
- Three public APIs use this architecture: DummyJSON (since week 18), DemoQA Book Store
  (week 19) and PetStore (added in Middle Stage 4 without changing the client). A fourth,
  local "job server" is a simulation started by the tests themselves.
- To test a new endpoint you add one service method and one test.


Quick start
-----------

In this folder:

   npm ci                              install the packages (once)
   npx playwright install chromium     install the browser for the one API + UI test
                                       (once)
   cp .env.example .env                make your local settings (once), then fill in the
                                       two DummyJSON passwords - see part 4
   npm run test:smoke                  6 tests: is everything up? (about 20 s)
   npx playwright test                 run all tests in the dev environment

A full run takes about 3 minutes: one test waits a real minute for a token to expire.
A local run prints the results in the terminal. For the HTML report (with the request log
of each test), add --reporter=html and then run npm run test:report. CI always makes the
HTML report.

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
   13. Files from earlier weeks


1. The layers
-------------

   test                 what to check: the scenario and the expected values
     |
   fixture              what the test needs, ready to use: services, a token, data,
     |                  and the cleanup after the test
   service              which endpoint: petstore.pets.get(7) -> GET /pet/7
     |
   ApiClient            how to send: base URL, headers, { status, ok, body, ... }
     |-- interceptors   added to every request: auth, retry, logging
     |
   HTTP (Playwright's request)

Each layer talks only to the one below it. A test does not know URLs; a service does not
know about retries; the client does not decide whether an answer is correct.

Next to these layers:
   assertions/   checks shared by several tests (one error check per API, cart totals)
   test-data/    factories that build new data, and constants
   mocks/        the local job server (a simulation, used only by tests/jobs/)

Named exceptions, on purpose: the smoke test, the four GET /test delay boundary tests
(there is no service for /test) and the unknown address test call the bare client, and
the interceptor tests build their own small clients - they test the client itself, so
they need to see it.


2. Where things are
-------------------

Shared by all APIs
   config/environments.ts      the environments (dev, staging) and their settings
   api/ApiClient.ts            the base client
   api/createApiClient.ts      builds a client the standard way (JSON headers, retry,
                               logging) - every API's fixture uses it
   api/interceptors/           auth.ts, retry.ts, logging.ts
   models/common.ts            ApiResponse<T> and other shapes all APIs share
   test-data/httpStatus.ts     status codes with names
   fixtures/base.fixture.ts    env and the request log
   config/tags.ts              the suite tags (smoke, regression, slow, ui)

Schemas (what an answer looks like - helpers/schema-changes.txt)
   schemas/petstore/swagger.json   a pinned copy of the PetStore's own contract
   schemas/dummyjson/, bookstore/  our practical schemas, one JSON file per answer
   assertions/schemaAssertions.ts  expectSchema(body, 'dummyjson/cart') - the check

Reports (used by CI)
   merge.config.ts             how CI glues the parts of a run into one HTML report and
                               one JSON file
   allurerc.mjs                the Allure report settings, with the run history
   scripts/ci-summary.js       turns the JSON file into the numbers on the run's Summary
                               page

One folder per API inside each layer

   DummyJSON
   services/dummyjson/         AuthService, ProductService, UserService, CartService,
                               PostService, CommentService, DummyJsonSession (logs in)
   models/dummyjson/           what we send and get back
   test-data/dummyjson/        buildUser, buildProduct, constants
   assertions/dummyjson/       cart totals, the DummyJSON error check
   fixtures/dummyjson.fixture.ts
   tests/dummyjson/

   DemoQA Book Store
   services/bookstore/         AccountService, BookStoreService, BookStoreSession (logs in)
   models/bookstore/           account.ts, book.ts
   test-data/bookstore/        buildCredentials(), constants (an unknown ISBN)
   assertions/bookstore/       the DemoQA error check
   pages/bookstore/            LoginPage, ProfilePage - for the one UI test only
   fixtures/bookstore.fixture.ts
   tests/bookstore/

   PetStore (new in Stage 4)
   services/petstore/          PetService, PetStoreUserService, StoreService (orders)
   models/petstore/            pet.ts, user.ts, order.ts, message.ts (code and type of the
                               swagger's error object; message is in models/common.ts)
   test-data/petstore/         petFactory.ts (uniqueId, buildPet, buildPetStoreUser,
                               buildOrder),
                               files.ts (a 1 x 1 PNG made in memory, for the upload)
   assertions/petstore/        the PetStore error check
   fixtures/petstore.fixture.ts
   tests/petstore/

   Local job server (new in Stage 4, a simulation)
   mocks/jobServer.ts          the server and a webhook receiver
   services/jobs/JobService.ts start, get, waitUntilFinished (polling)
   models/jobs/job.ts
   fixtures/jobs.fixture.ts
   tests/jobs/


3. ApiClient and the interceptors
---------------------------------

ApiClient sends a request and always gives back the same shape:

   { status, ok, body, durationMs, attempts }

It never throws because of a status: a 401 comes back like a 200, because negative tests
need to see it. It throws only when the server does not answer at all. An answer that is
not JSON is kept as text in body.message; an empty answer becomes {}.

Headers: createApiClient gives every client the JSON headers (Content-Type and Accept).
A request can add its own with "headers", and "token" becomes
"Authorization: Bearer <token>". The headers are not set in playwright.config.ts on
purpose - there they would also go to the browser pages of the UI test.

The body of a request - two ways
   data         a JSON body (the usual way). A Buffer is sent byte for byte - that is
                how the tests send text that is not valid JSON.
   multipart    a form with fields and files (new in Stage 4, for the PetStore upload).
                The client then leaves out its JSON Content-Type: Playwright writes
                "multipart/form-data; boundary=..." itself. Without that, the server
                answers 415.

About the body type: body has the shape of a successful answer. On an error answer only
the error fields are really there - so check the status first. We keep it this simple on
purpose: a strict "data or error" type would make every negative test longer.

An interceptor is a small function that every request passes through. It can change the
request, send it again, or write something down.

auth (api/interceptors/auth.ts)
   Adds "Authorization: Bearer <token>" when the request has no token. If the server
   answers 401, it gets a new token once and tries again. If no new token can be got,
   the test gets that 401 - not an exception. A request that brings its own token - even
   a wrong one - is left alone, so tests about tokens keep full control.
   Each API gives its own TokenSource (the object that gets and renews the token):
   DummyJsonSession for DummyJSON, BookStoreSession for DemoQA. PetStore needs no login.

retry (api/interceptors/retry.ts)
   Sends a request again when the server is briefly unavailable:
   - GET:     an answer 502, 503 or 504, or no answer at all (timeout, connection error);
   - DELETE:  an answer 502, 503 or 504 only. Deleting twice ends the same way as
              deleting once, so a cleanup survives a short outage. Not on "no answer":
              the first DELETE may have worked, and the second would get a 404.
   Not repeated: POST (could create the same thing twice); PUT (idempotent, but no
   request of the tests needs it - kept out until one does); 500 (usually a bug that
   answers the same way every time); 4xx (would fail the same way).
   How many times: http.retries in the environment (dev 0, staging 2).

logging (api/interceptors/logging.ts)
   Writes one line per real request, for example
      GET /auth/me -> 401 (212 ms) [token]
   The lines are attached to each test in the HTML report as "api-log".


4. Environments
---------------

config/environments.ts has one block per environment:

   dev       DummyJSON user emilys,   no retries,  timeout 10 s
   staging   DummyJSON user michaelw, 2 retries,   timeout 15 s

DemoQA and PetStore have no fixed user: each test makes its own account, pet or user.
DemoQA uses 30 s per request in both environments, because a DemoQA login can take up
to 7 s. Request logging is on in both, so a retry in staging is visible in the report.

Choose one when you run the tests:

   TEST_ENV=staging npx playwright test        (dev is the default)

Secrets are not in the code. The DummyJSON password of each environment comes from a
variable: DUMMYJSON_PASSWORD_DEV and DUMMYJSON_PASSWORD_STAGING.
   locally   in the file .env (copy .env.example, fill it in; .env is never committed)
   in CI     GitHub Secrets with the same names (Settings > Secrets and variables >
             Actions); the workflow passes them to the tests
The password is read only when a test logs in to DummyJSON. If it is missing, every
DummyJSON test fails with the same clear message, and the tests of the other APIs still run:
   DUMMYJSON_PASSWORD_DEV is not set. Locally: copy .env.example to .env ...
The DummyJSON user is fixed per environment and cannot be overridden - a user without its
own password would only fail to log in.

Other values can be changed without touching the file, with a variable in .env or in CI:
DUMMYJSON_URL, BOOKSTORE_URL, PETSTORE_URL.

Local run vs CI run (playwright.config.ts, switched by the CI variable):
   local     no retries, list reporter, a trace is kept for a failed test
   CI        1 retry (a test that passes only then is "flaky"), HTML report, test.only
             forbidden, no trace (it would record the login password) - except for
             the UI test, which keeps its trace and gets a screenshot when it fails

A wrong name stops the run with a clear message:
   Unknown TEST_ENV "prod". Use one of: dev, staging

Note: each API has only one public server, so both environments use the same addresses.
They show the mechanism: another user, other HTTP settings, the same code.

Good to know: staging retries a DemoQA GET too. If DemoQA does not answer at all, one GET
can wait 3 x 30 s - longer than the 60 s a test may take. The test then stops with
Playwright's "test timeout". Accepted: it happens only when the site is down.

CI runs the API tests in both environments (a matrix in
.github/workflows/week20-middle4-5.yml); the API + UI test runs in its own job, in dev.


5. Fixtures - what a test can ask for
-------------------------------------

From fixtures/base.fixture.ts (every API):
   env          the settings of the chosen environment
   apiLog       the request log, attached to the report after each test

From fixtures/dummyjson.fixture.ts:
   api                services WITHOUT login - a request has a token only if the test
                      passes one. Use it for negative and token tests.
   authApi            the same services WITH the auth interceptor - logged in as the
                      environment's user. The default for endpoints that need a login.
   authToken          a fresh token, for tests that pass a token by hand
   session            the login behind authApi
   apiClient          the bare client (the smoke test, the delay boundaries, the
                      unknown address test)
   postWithComments   an existing post that has comments, found through the API
                      (DummyJSON does not save new data, so we look data up)

From fixtures/bookstore.fixture.ts:
   bookstore          Book Store services WITHOUT login
   catalog            the books of the store, read before the test
   reader             a NEW account, opened before the test and closed after it
   readerApi          services logged in as the reader
   newReader()        opens one more new account, for tests with two readers
   accountCleanup     closes every account after the test, also when the test fails.
                      First with the account's token; if that does not give 204, or no
                      token can be got (an account made by a boundary test can never log
                      in), with the user name and password (Basic auth). If neither
                      way gives a clear "deleted", it asks DemoQA whether the account
                      still exists: gone = a "cleanup note", still there = "leaked data"
                      with what both ways answered.
                      A test that opens an account itself calls remember(), and forget()
                      if it closed the account on its own.

The setup steps of these fixtures (the catalog, a new reader, a new pet) skip the test
with the reason "infrastructure: ..." when the server answers 502, 503, 504 or not at all
(fixtures/infrastructure.ts) - an outage is shown as what it is, not as a failed test.

From fixtures/petstore.fixture.ts (new in Stage 4):
   petstore           PetStore services (no login - the public server needs none)
   pet                a NEW pet, created before the test and deleted after it
   petstoreCleanup    deletes every pet, user and order the test registered, also when
                      the test fails: petstoreCleanup.pet(id), .user(name), .order(id).
                      404 is fine (the test may have deleted it itself); anything else is
                      marked as "leaked data".

From fixtures/jobs.fixture.ts (new in Stage 4):
   jobs               the job API of a local job server, started for this test only, on a
                      free port, without retries
   webhooks           a local receiver for the calls the job server makes when a job ends;
                      waitFor(jobId, timeoutMs) waits for the call, without polling

Which one do I use?
   DummyJSON, the endpoint needs a login        -> authApi
   DummyJSON, the test is about tokens          -> api + authToken
   Book Store, one reader's own data            -> reader + readerApi
   Book Store, the test needs a second reader   -> newReader()
   Book Store, the test opens the account itself -> bookstore + accountCleanup.remember()
   PetStore, the test needs an existing pet     -> pet
   PetStore, the test creates its own data      -> petstore + petstoreCleanup, registered
                                                   BEFORE the create request
   Background jobs                              -> jobs (+ webhooks)
   The client or an interceptor itself          -> build a small ApiClient in the test
                                                   (see interceptors.spec.ts)

DemoQA keeps only the NEWEST token of an account: every new login ends the old token.
Each reader therefore has one login session, shared by readerApi and the cleanup.


6. How to add a new test
------------------------

1. Put it in tests/<api>/, next to tests about the same resource.
2. Import test and expect from the fixture file of that API:
      import { test, expect } from '../../fixtures/petstore.fixture';
      import { HttpStatus } from '../../test-data/httpStatus';
3. Ask for what you need and call services:

      test('a new pet can be read', async ({ petstore, pet }) => {
        const { status, body } = await petstore.pets.get(pet.id);
        expect(status).toBe(HttpStatus.OK);
        expect(body.name).toBe(pet.name);
      });

4. Keep the expected values in the test (see "Rules we keep").
5. An edge case test: follow the checklist in edge-case-strategy.txt, part 11.


7. How to add a new endpoint to an existing service
---------------------------------------------------

This is how product search was added: GET /products/search?q=<word>.

1. If the answer has a new shape, add an interface in models/<api>/. Here the shape
   existed already (ProductsPage), so nothing to add.
2. Add one method to the service (services/dummyjson/ProductService.ts):

      search(query: string) {
        return this.client.get<ProductsPage>('/products/search', { params: { q: query } });
      }

3. Write the test (tests/dummyjson/productSearch.spec.ts).

Nothing else changes - api.products.search() exists in every test at once. Stage 4 did
the same for the upload: PetService.uploadImage(id, form) is one method.


8. How to add a new service
---------------------------

This is how PostService was added (and StoreService for PetStore in Stage 4).

1. Model - models/dummyjson/post.ts: interfaces for what the endpoint returns (Post,
   PostsPage) and what you send (NewPost). Only the fields the tests use.

2. Service - services/dummyjson/PostService.ts:

      export class PostService {
        constructor(private readonly client: ApiClient) {}

        getById(id: number) {
          return this.client.get<Post>(`/posts/${id}`);
        }
      }

   One method per endpoint. No expect(), no URLs outside the service, no token handling.

3. Register it - one line in servicesFor() in the API's fixture file:
      posts: new PostService(client),
   From now on api.posts and authApi.posts exist in every test.

4. Test - tests/dummyjson/posts.spec.ts.

Not needed: changes in ApiClient, the interceptors, the config, the other services or
the other tests.


9. How to add a new environment
-------------------------------

1. Add a name to EnvironmentName in config/environments.ts.
2. Add its block to the environments list.
3. Run with TEST_ENV=<name>. In CI, add the name to the matrix.


10. How to add a new API
------------------------

This is how PetStore was added in Middle Stage 4 - the files in brackets are the real
example. DemoQA was added the same way in week 19.

1. Config (config/environments.ts): a block for the new API in the Environment type and
   in each environment; an override from .env if needed.
   (petstore: baseUrl only, override PETSTORE_URL)
2. Folders: services/<api>/, models/<api>/, tests/<api>/, test-data/<api>/.
3. If the API needs a login: a small class that implements TokenSource (getToken,
   refresh). (PetStore needs none.)
4. A fixture file fixtures/<api>.fixture.ts that extends base.fixture.ts and builds its
   services on createApiClient(...) - so it gets the same headers, retries and logging.
   If the API saves data, add a cleanup fixture.
   (fixtures/petstore.fixture.ts with petstoreCleanup)
5. API-specific answer fields go into the API's own models, not into the shared ones.
   (models/petstore/message.ts - code and type of the swagger's error object)
6. If the API's errors have their own shape, add one error check for it.
   (assertions/petstore/errorAssertions.ts)

ApiClient, createApiClient and the interceptors stay as they are. (The one client change
in Stage 4, multipart, was a new way to send a body, not something PetStore needed to
start.)


11. How to run
--------------

In this folder:

   npm ci                                install the packages
   npx tsc --noEmit                      check the types
   npx playwright test                   all tests, environment dev
   npm run test:smoke                    the smoke suite (tag @smoke, 6 tests)
   npm run test:regression               the regression suite (tag @regression - all
                                         tests except the 1-minute token test)
   npm run test:full                     everything
   npm run test:smoke -- --grep-invert @ui   a suite without the browser test (as in CI)
   TEST_ENV=staging npx playwright test  all tests, environment staging
   npx playwright test tests/petstore    one folder
   npx playwright test --grep-invert @ui only the API tests
   npx playwright test --grep @ui        only the API + UI test (needs the browser)
   npx playwright test --grep-invert @slow   everything except the 1-minute token test
   npx playwright test --repeat-each=3 tests/petstore/uploadImage.spec.ts
                                         one file three times - before a commit
   npx playwright test --reporter=html   all tests, with the HTML report
   npm run test:report                   open that HTML report
   CI=1 npm run test:smoke               a run like CI: it also writes the raw Allure
                                         results (allure-results/)
   npm run allure:report                 build the Allure report from them and open it

On Windows PowerShell: $env:TEST_ENV="staging"; npx playwright test

CI (.github/workflows/week20-middle4-5.yml) runs the API tests in dev and staging, and
the API + UI test in its own job (ui-test). Which suite runs depends on what started it:
   pull request to main   smoke         (no UI job)
   push to main           regression    + the UI job
   every night 02:00 UTC  full          + the UI job
   by hand (Run workflow) the suite you choose
In CI a failed test is retried once.

How a CI run is built - think of it as four groups of jobs, one after another:

   checks     a quick look before anything else: do the types compile, does every test
              have a suite tag, and which tests does this run need. If this fails,
              nothing else starts - no point in running tests on broken code.
   test       the API tests themselves - one job per environment. For regression and
              the night run, the dev tests are split in two halves ("shards") that run
              on two machines at the same time, so the run finishes sooner.
   ui-test    the browser test, at the same time as the API tests (not for smoke). It
              runs inside Playwright's ready-made Docker image, so no time goes into
              installing a browser (ci-improvements.txt, part 2).
   report     one per environment, after all tests are done - also when some failed.
              It glues the halves together and produces what you download from the run:
                 playwright-report-...   the HTML report (open index.html)
                 allure-report-...       the Allure report, with charts of the last runs
                 results-json-...        the raw numbers (used later by the AI triage)
              It also writes a small table into the run's Summary page: how many tests
              passed, failed, were flaky, and the pass rate.

The Allure report remembers the earlier runs of the same suite and environment, so it can
show trends - is the pass rate going down, which tests are flaky again and again.


12. Rules we keep
-----------------

- Tests do not build URLs or headers (exceptions: part 1). Services do not use expect().
  The client does not decide what is right or wrong.
- Expected values stay in the test (messages, numbers). A helper that also checks the
  status would hide the most important line. The error checks are the exception: the
  error SHAPE is a rule shared by all endpoints of an API.
- A test that fails because the API does not do what it should is declared as
  test.fail('title', ...), with a short "known deviation: ..." comment above it (for
  table rows: above the table), and listed in
  assertion-notes.txt. Never test.fail() inside the test.
- Where possible a test.fail test checks the rule, so a fix in any correct direction is
  noticed (assertion-notes.txt, part 8).
- Own data for every test, with a unique name or id, registered for cleanup BEFORE the
  request that creates it.
- PetStore ids always come from our factory: ids made by the server are too large for a
  JavaScript number.
- No sleep. Any waiting has an interval and a limit (expect.poll, waitUntilFinished).
- No upper time limits in checks ("answered within N s"): they make a test depend on the
  network. A lower limit ("waited at least the delay") is fine. Two exceptions on
  purpose, both from week 18: "a page of products responds in less than 3000 ms"
  (pagination.spec.ts - a response time check is what that test is for), and deletedOn
  "within 1 minute of now" (productCrud.spec.ts - it checks a date in the answer against
  our clock, not how fast the answer came).
- Limits that depend on data are read from the API, not written into the test.
- Only add a shared helper when it is a real rule used by several tests. Two similar
  lines are not a reason for a helper.
- Every test has a suite tag, from config/tags.ts (never the plain text): a describe
  block gets Tag.REGRESSION; a test that also belongs to smoke adds Tag.SMOKE; a test
  that waits a long time gets Tag.SLOW (and no REGRESSION); a test that needs a browser
  gets Tag.UI.
- Smoke stays small: one or two happy paths per API, no test.fail, under a minute. CI
  fails when a test has neither Tag.REGRESSION nor Tag.SLOW (step "Every test is in a
  suite"), so a forgotten tag cannot silently drop a test from regression.
- API + UI tests: prepare the data through the API FIRST, then log in through the UI.


13. Files from earlier weeks
----------------------------

This folder started as a copy of week 19. Some test comments point to Stage 3 documents
that stay in the week 19 folder ("Week19. Middle Stage 2-3/helpers/"):
   coverage-gaps.txt   the gap numbers S1-S10 (tokens.spec.ts, collection.spec.ts,
                       bulkAdd.spec.ts)
   modality.txt        why API, why UI, why both (profileUi.spec.ts)
   ai-review.txt       the Stage 3 AI tasks (tokens.spec.ts)
