import { TokenSource } from '../../api/interceptors/auth';
import { Credentials } from '../../models/bookstore/account';
import { AccountService } from './AccountService';

// The DemoQA way to get tokens, for the auth interceptor: POST /Account/v1/GenerateToken.
// DemoQA has no refresh token, so "refresh" simply generates a new token.
// Use it with an AccountService on a client WITHOUT the auth interceptor.
export class BookStoreSession implements TokenSource {
  private token?: string;
  private running?: Promise<void>; // a token request that has started and not finished

  constructor(
    private readonly account: AccountService,
    private readonly credentials: Credentials,
  ) {}

  async getToken() {
    if (!this.token) await this.once();
    return this.token!;
  }

  async refresh() {
    await this.once();
    return this.token!;
  }

  // two requests at the same time ask for one token, not two
  private once() {
    this.running ??= this.generate().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async generate() {
    const { status, body } = await this.account.generateToken(this.credentials);
    // a wrong password is answered with 200 and status "Failed", so check the body
    if (body.status !== 'Success' || !body.token) {
      const reason = body.result ?? body.message ?? '';
      throw new Error(`login as ${this.credentials.userName} failed: ${status} ${reason}`);
    }
    this.token = body.token;
  }
}
