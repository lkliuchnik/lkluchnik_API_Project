import { Book } from './book';

// DemoQA errors carry a code besides the message, for example
// { "code": "1205", "message": "ISBN supplied is not available in Books Collection!" }.
export interface BookStoreError {
  code?: string;
}

// What a reader sends to open an account or to log in.
export interface Credentials {
  userName: string;
  password: string;
}

// Answer of POST /Account/v1/User. Note the spelling: userID here, userId elsewhere.
export interface CreatedAccount {
  userID: string;
  username: string;
  books: Book[];
}

// Answer of POST /Account/v1/GenerateToken. A wrong password still gives 200,
// with status "Failed" and token null.
export interface TokenResponse {
  token: string | null;
  status: 'Success' | 'Failed';
  result: string;
}

// Answer of POST /Account/v1/Login: the account with its CURRENT token - and also the password,
// which must not be there. The security test in tokens.spec.ts reads the whole answer as text,
// so only that field is described here.
export interface LoginResponse {
  password?: string;
}

// Answer of GET /Account/v1/User/{userId}, and of PUT /BookStore/v1/Books/{isbn}.
// It also has userId and username; the tests read only the books.
export interface Account {
  books: Book[];
}
