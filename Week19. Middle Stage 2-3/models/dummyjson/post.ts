import { Page } from './page';

// Only the fields the tests use. DummyJSON returns more.
export interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

// Request body for POST /posts/add.
export interface NewPost {
  title: string;
  body: string;
  userId: number;
}

export interface PostsPage extends Page {
  posts: Post[];
}
