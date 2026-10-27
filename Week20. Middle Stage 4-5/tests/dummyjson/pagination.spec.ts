import { test, expect } from '../../fixtures/dummyjson.fixture';
import { HttpStatus } from '../../test-data/httpStatus';
import { Tag } from '../../config/tags';

test.describe('Product pagination', { tag: Tag.REGRESSION }, () => {
  const PAGE_SIZE = 10;
  const MAX_RESPONSE_TIME_MS = 3000;

  test('page 3 returns 10 items and correct pagination metadata', async ({ api }) => {
    const page = 3;
    const skip = (page - 1) * PAGE_SIZE;

    const { status, body } = await api.products.getPage(PAGE_SIZE, skip);

    expect(status).toBe(HttpStatus.OK);
    expect(body.limit).toBe(PAGE_SIZE);
    expect(body.skip).toBe(skip);
    expect(body.products.length).toBe(PAGE_SIZE);
    expect(body.total).toBeGreaterThanOrEqual(skip + PAGE_SIZE); // enough products for a full page 3
  });

  test('the page count is right: the last page has the remaining items, the next page is empty', async ({
    api,
  }) => {
    const { status: firstStatus, body: firstPage } = await api.products.getPage(PAGE_SIZE, 0);
    expect(firstStatus, 'precondition: the first page gives the total').toBe(HttpStatus.OK);
    const total = firstPage.total;
    const pageCount = Math.ceil(total / PAGE_SIZE);
    const lastPageSkip = (pageCount - 1) * PAGE_SIZE;

    const { status, body: lastPage } = await api.products.getPage(PAGE_SIZE, lastPageSkip);

    expect(status).toBe(HttpStatus.OK);
    expect(lastPage.total).toBe(total);
    expect(lastPage.products.length).toBe(total - lastPageSkip);

    // if pageCount were too small, this page would still have products
    const { status: nextStatus, body: nextPage } = await api.products.getPage(PAGE_SIZE, pageCount * PAGE_SIZE);
    expect(nextStatus).toBe(HttpStatus.OK);
    expect(nextPage.products).toEqual([]);

    test.info().annotations.push({
      type: 'page count',
      description: `${total} products / ${PAGE_SIZE} per page = ${pageCount} pages`,
    });
  });

  test('two neighbouring pages do not share any product', async ({ api }) => {
    const { status: status1, body: page1 } = await api.products.getPage(PAGE_SIZE, 0);
    const { status: status2, body: page2 } = await api.products.getPage(PAGE_SIZE, PAGE_SIZE);

    // without these checks, two empty pages would also "share nothing"
    expect(status1).toBe(HttpStatus.OK);
    expect(status2).toBe(HttpStatus.OK);
    expect(page1.products.length).toBe(PAGE_SIZE);
    expect(page2.products.length).toBe(PAGE_SIZE);

    const page1Ids = page1.products.map((product) => product.id);
    const page2Ids = page2.products.map((product) => product.id);
    const sharedIds = page1Ids.filter((id) => page2Ids.includes(id));

    expect(sharedIds).toEqual([]);
  });

  test(`a page of products responds in less than ${MAX_RESPONSE_TIME_MS} ms`, async ({ api }) => {
    const { status, durationMs, attempts } = await api.products.getPage(PAGE_SIZE, 0);

    // the measured time is shown in the HTML report, also when the test passes
    test.info().annotations.push({ type: 'response time', description: `${durationMs} ms` });

    expect(status).toBe(HttpStatus.OK);
    expect(attempts, 'answered at the first try - no retry hidden in the time').toBe(1);
    expect(durationMs).toBeLessThan(MAX_RESPONSE_TIME_MS);
  });
});
