import { ApiClient } from '../../api/ApiClient';
import { DeletedProduct, NewProduct, Product, ProductsPage } from '../../models/dummyjson/product';

export class ProductService {
  constructor(private readonly client: ApiClient) {}

  getPage(limit: number, skip: number) {
    return this.client.get<ProductsPage>('/products', { params: { limit, skip } });
  }

  // The same list behind auth. No token = the request is sent without the header.
  getProtectedPage(limit: number, token?: string) {
    return this.client.get<ProductsPage>('/auth/products', { params: { limit }, token });
  }

  getById(id: number) {
    return this.client.get<Product>(`/products/${id}`);
  }

  add(product: NewProduct) {
    return this.client.post<Product>('/products/add', { data: product });
  }

  update(id: number, fields: Partial<NewProduct>) {
    return this.client.put<Product>(`/products/${id}`, { data: fields });
  }

  delete(id: number) {
    return this.client.delete<DeletedProduct>(`/products/${id}`);
  }
}
