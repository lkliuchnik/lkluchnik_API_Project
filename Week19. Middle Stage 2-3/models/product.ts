import { Page } from './common';

// Only the fields the tests use. DummyJSON returns more.
export interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  category: string;
  stock: number;
}

// Request body for POST /products/add and PUT /products/{id}.
export interface NewProduct {
  title: string;
  price: number;
  category: string;
  stock: number;
}

export interface DeletedProduct extends Product {
  isDeleted: boolean;
  deletedOn: string;
}

export interface ProductsPage extends Page {
  products: Product[];
}
