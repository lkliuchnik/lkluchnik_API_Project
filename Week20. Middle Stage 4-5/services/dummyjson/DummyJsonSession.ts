import { TokenSource } from '../../api/interceptors/auth';
import { AuthService } from './AuthService';

// The DummyJSON way to get tokens, for the auth interceptor.
// Logs in on the first request and keeps the tokens for one test.
// Use it with an AuthService on a client WITHOUT the auth interceptor - otherwise the
// login request would ask this session for a token and wait for itself.
export class DummyJsonSession implements TokenSource {
  private accessToken?: string;
  private refreshToken?: string;
  private running?: Promise<void>; // a login or refresh that has started and not finished

  constructor(
    private readonly auth: AuthService,
    private readonly user: { username: string; password: string },
  ) {}

  async getToken() {
    if (!this.accessToken) await this.once(() => this.login());
    return this.accessToken!;
  }

  async refresh() {
    await this.once(() => this.renew());
    return this.accessToken!;
  }

  // Two requests at the same time must not log in (or refresh) twice: the second one
  // waits for the first.
  private once(task: () => Promise<void>) {
    this.running ??= task().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  // a new token from the refresh token; if that does not work, a new login
  private async renew() {
    if (this.refreshToken) {
      const { ok, body } = await this.auth.refresh(this.refreshToken);
      if (ok && body.accessToken) {
        this.accessToken = body.accessToken;
        this.refreshToken = body.refreshToken;
        return;
      }
    }
    await this.login();
  }

  private async login() {
    const { ok, status, body } = await this.auth.login(this.user.username, this.user.password);
    if (!ok || !body.accessToken) {
      throw new Error(`login as ${this.user.username} failed: ${status} ${body.message ?? ''}`);
    }
    this.accessToken = body.accessToken;
    this.refreshToken = body.refreshToken;
  }
}
