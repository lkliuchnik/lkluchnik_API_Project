import { Page } from './common';

// One product line inside a cart.
export interface CartLine {
  id: number;
  title: string;
  price: number;
  quantity: number;
  total: number;
  discountPercentage: number;
  discountedTotal: number;
}

export interface Cart {
  id: number;
  userId: number;
  products: CartLine[];
  total: number;
  discountedTotal: number;
  totalProducts: number;
  totalQuantity: number;
}

export interface CartsPage extends Page {
  carts: Cart[];
}

// One item in the request body of POST /carts/add.
export interface NewCartItem {
  id: number;
  quantity: number;
}
