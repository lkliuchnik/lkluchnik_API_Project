import { ApiClient } from '../../api/ApiClient';
import { Cart, CartsPage, NewCartItem } from '../../models/dummyjson/cart';

export class CartService {
  constructor(private readonly client: ApiClient) {}

  // No token: the auth interceptor adds one (authApi), or the request goes without it (api).
  getByUser(userId: number, token?: string) {
    return this.client.get<CartsPage>(`/auth/carts/user/${userId}`, { token });
  }

  add(userId: number, products: NewCartItem[]) {
    return this.client.post<Cart>('/carts/add', { data: { userId, products } });
  }
}
