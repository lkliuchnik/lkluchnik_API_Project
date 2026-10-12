import { ApiClient } from '../../api/ApiClient';
import { Comment, CommentsPage, NewComment } from '../../models/dummyjson/comment';

export class CommentService {
  constructor(private readonly client: ApiClient) {}

  getPage(limit: number, skip: number) {
    return this.client.get<CommentsPage>('/comments', { params: { limit, skip } });
  }

  getByPost(postId: number) {
    return this.client.get<CommentsPage>(`/comments/post/${postId}`);
  }

  add(comment: NewComment) {
    return this.client.post<Comment>('/comments/add', { data: comment });
  }
}
