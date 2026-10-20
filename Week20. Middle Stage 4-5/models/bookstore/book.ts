// A book as the catalog and a reader's collection return it.
export interface Book {
  isbn: string;
  title: string;
  subTitle: string;
  author: string;
  publish_date: string;
  publisher: string;
  pages: number;
  description: string;
  website: string;
}

// Answer of GET /BookStore/v1/Books.
export interface BookList {
  books: Book[];
}

// Answer of POST /BookStore/v1/Books - only the ISBNs that were added.
export interface AddedBooks {
  books: { isbn: string }[];
}
