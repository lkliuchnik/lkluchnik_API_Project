export interface ProductPayload {
  title: string;
  price: number;
  category: string;
  stock: number;
}

// Returns new product data with a unique title on every call.
export function buildProduct(overrides: Partial<ProductPayload> = {}): ProductPayload {
  return {
    title: `QA Product ${Date.now()}`,
    price: 25,
    category: 'groceries',
    stock: 10,
    ...overrides,
  };
}
