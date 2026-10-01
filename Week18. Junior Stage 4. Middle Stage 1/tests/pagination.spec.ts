import { test, expect } from '@playwright/test';
import { getProducts } from '../helpers/dummyApi';
import { HttpStatus } from '../test-data/httpStatus';

test.describe('Product pagination', () => {
  const PAGE_SIZE = 10;

  test('page 3 returns 10 items and correct pagination metadata', async ({ request }) => {
    const page = 3;
    const skip = (page - 1) * PAGE_SIZE;

    const { status, body } = await getProducts(request, PAGE_SIZE, skip);

    expect(status).toBe(HttpStatus.OK);
    expect(body.limit).toBe(PAGE_SIZE);
    expect(body.skip).toBe(skip);
    expect(body.products.length).toBe(PAGE_SIZE);
    expect(body.total).toBeGreaterThan(skip + PAGE_SIZE);

    const pageCount = Math.ceil(body.total / PAGE_SIZE);
    console.log(`total: ${body.total}, items per page: ${PAGE_SIZE}, page count: ${pageCount}`);
    expect(pageCount).toBeGreaterThanOrEqual(page);
  });

  test('the last page contains only the remaining items', async ({ request }) => {
    const { body: firstPage } = await getProducts(request, PAGE_SIZE, 0);
    const total = firstPage.total;
    const pageCount = Math.ceil(total / PAGE_SIZE);
    const lastPageSkip = (pageCount - 1) * PAGE_SIZE;

    const { status, body: lastPage } = await getProducts(request, PAGE_SIZE, lastPageSkip);

    expect(status).toBe(HttpStatus.OK);
    expect(lastPage.total).toBe(total);
    expect(lastPage.products.length).toBe(total - lastPageSkip);
  });

  test('two neighbouring pages do not share any product', async ({ request }) => {
    const { body: page1 } = await getProducts(request, PAGE_SIZE, 0);
    const { body: page2 } = await getProducts(request, PAGE_SIZE, PAGE_SIZE);

    const page1Ids = page1.products.map((product: { id: number }) => product.id);
    const page2Ids = page2.products.map((product: { id: number }) => product.id);
    const sharedIds = page1Ids.filter((id: number) => page2Ids.includes(id));

    expect(sharedIds).toEqual([]);
  });

  test('a page of products responds in less than 3000 ms', async ({ request }) => {
    const startTime = Date.now();
    const { status } = await getProducts(request, PAGE_SIZE, 0);
    const responseTime = Date.now() - startTime;

    console.log(`GET /products took ${responseTime} ms`);

    expect(status).toBe(HttpStatus.OK);
    expect(responseTime).toBeLessThan(3000);
  });
});
