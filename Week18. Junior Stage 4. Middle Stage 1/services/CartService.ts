import { ApiClient } from '../api/ApiClient';
import { Cart, CartsPage, NewCartItem } from '../models/cart';

export class CartService {
  constructor(private readonly client: ApiClient) {}

  getByUser(userId: number, token: string) {
    return this.client.get<CartsPage>(`/auth/carts/user/${userId}`, { token });
  }

  add(userId: number, products: NewCartItem[]) {
    return this.client.post<Cart>('/carts/add', { data: { userId, products } });
  }
}
