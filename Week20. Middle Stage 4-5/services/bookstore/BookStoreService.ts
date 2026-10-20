import { ApiClient } from '../../api/ApiClient';
import { Account, BookStoreError } from '../../models/bookstore/account';
import { AddedBooks, BookList } from '../../models/bookstore/book';

// The catalog, and the books in a reader's collection.
// Methods that change a collection take the token as optional: the auth interceptor adds it
// (readerApi), or the request goes without it.
export class BookStoreService {
  constructor(private readonly client: ApiClient) {}

  getCatalog() {
    return this.client.get<BookList>('/BookStore/v1/Books');
  }

  addBooks(userId: string, isbns: string[], token?: string) {
    const collectionOfIsbns = isbns.map((isbn) => ({ isbn }));
    return this.client.post<AddedBooks & BookStoreError>('/BookStore/v1/Books', {
      data: { userId, collectionOfIsbns },
      token,
    });
  }

  // Sends the body as given - for negative tests: a missing field or a wrong type.
  // For a body that is not valid JSON pass a Buffer: it goes byte for byte. A string would be
  // JSON-encoded by Playwright (the client sends Content-Type: application/json) and arrive
  // as a valid JSON string.
  addBooksRaw(body: unknown, token?: string) {
    return this.client.post<AddedBooks & BookStoreError>('/BookStore/v1/Books', { data: body, token });
  }

  replaceBook(userId: string, oldIsbn: string, newIsbn: string, token?: string) {
    return this.client.put<Account & BookStoreError>(`/BookStore/v1/Books/${oldIsbn}`, {
      data: { userId, isbn: newIsbn },
      token,
    });
  }

  deleteBook(userId: string, isbn: string, token?: string) {
    return this.client.delete<BookStoreError>('/BookStore/v1/Book', { data: { userId, isbn }, token });
  }

  deleteAllBooks(userId: string, token?: string) {
    return this.client.delete<BookStoreError>('/BookStore/v1/Books', { params: { UserId: userId }, token });
  }
}
