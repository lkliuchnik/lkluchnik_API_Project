import { APIRequestContext } from '@playwright/test';
import { ProductPayload } from '../test-data/productFactory';
import { UserPayload } from '../test-data/userFactory';

async function readBody(response: { text: () => Promise<string> }) {
  const raw = await response.text();
  if (!raw) return null;

  // some error responses are plain text, not JSON
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

// ---------- auth ----------

export async function login(request: APIRequestContext, username: string, password: string) {
  const response = await request.post('/auth/login', { data: { username, password } });
  return { status: response.status(), body: await readBody(response) };
}

export async function getAuthToken(request: APIRequestContext): Promise<string> {
  const { body } = await login(
    request,
    process.env.AUTH_USERNAME ?? 'emilys',
    process.env.AUTH_PASSWORD ?? 'emilyspass',
  );
  return body?.accessToken;
}

export async function getCurrentUser(request: APIRequestContext, token: string) {
  const response = await request.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: response.status(), body: await readBody(response) };
}

export async function getProtectedProducts(request: APIRequestContext, token?: string) {
  const response = await request.get('/auth/products?limit=5', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: response.status(), body: await readBody(response) };
}

// ---------- products ----------

export async function getProducts(request: APIRequestContext, limit: number, skip: number) {
  const response = await request.get(`/products?limit=${limit}&skip=${skip}`);
  return { status: response.status(), body: await readBody(response) };
}

export async function getProduct(request: APIRequestContext, id: number) {
  const response = await request.get(`/products/${id}`);
  return { status: response.status(), body: await readBody(response) };
}

export async function addProduct(request: APIRequestContext, product: ProductPayload) {
  const response = await request.post('/products/add', { data: product });
  return { status: response.status(), body: await readBody(response) };
}

export async function updateProduct(request: APIRequestContext, id: number, fields: Partial<ProductPayload>) {
  const response = await request.put(`/products/${id}`, { data: fields });
  return { status: response.status(), body: await readBody(response) };
}

export async function deleteProduct(request: APIRequestContext, id: number) {
  const response = await request.delete(`/products/${id}`);
  return { status: response.status(), body: await readBody(response) };
}

// ---------- users ----------

export async function getUser(request: APIRequestContext, id: number) {
  const response = await request.get(`/users/${id}`);
  return { status: response.status(), body: await readBody(response) };
}

export async function addUser(request: APIRequestContext, user: UserPayload) {
  const response = await request.post('/users/add', { data: user });
  return { status: response.status(), body: await readBody(response) };
}

export async function updateUser(request: APIRequestContext, id: number, fields: Partial<UserPayload>) {
  const response = await request.put(`/users/${id}`, { data: fields });
  return { status: response.status(), body: await readBody(response) };
}

// ---------- carts ----------

export async function getCartsOfUser(request: APIRequestContext, userId: number, token: string) {
  const response = await request.get(`/auth/carts/user/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: response.status(), body: await readBody(response) };
}

export async function addCart(
  request: APIRequestContext,
  userId: number,
  products: { id: number; quantity: number }[],
) {
  const response = await request.post('/carts/add', { data: { userId, products } });
  return { status: response.status(), body: await readBody(response) };
}
