import { ApiClient } from '../../api/ApiClient';
import { NewPost, Post, PostsPage } from '../../models/dummyjson/post';

export class PostService {
  constructor(private readonly client: ApiClient) {}

  getById(id: number) {
    return this.client.get<Post>(`/posts/${id}`);
  }

  getByUser(userId: number) {
    return this.client.get<PostsPage>(`/posts/user/${userId}`);
  }

  add(post: NewPost) {
    return this.client.post<Post>('/posts/add', { data: post });
  }
}
