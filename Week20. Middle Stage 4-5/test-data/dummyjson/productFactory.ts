import { randomUUID } from 'crypto';
import { NewProduct } from '../../models/dummyjson/product';

// Returns new product data with a unique title on every call.
export function buildProduct(overrides: Partial<NewProduct> = {}): NewProduct {
  return {
    title: `QA Product ${randomUUID().slice(0, 8)}`,
    price: 25,
    category: 'groceries',
    stock: 10,
    ...overrides,
  };
}
