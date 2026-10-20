import { Page } from './page';

// Only the fields the tests use. DummyJSON returns more.
export interface Comment {
  id: number;
  body: string;
  postId: number;
  user: {
    id: number;
    username: string;
  };
}

// Request body for POST /comments/add.
export interface NewComment {
  body: string;
  postId: number;
  userId: number;
}

export interface CommentsPage extends Page {
  comments: Comment[];
}
