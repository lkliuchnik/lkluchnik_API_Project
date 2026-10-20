import { Page } from '@playwright/test';
import { Credentials } from '../../models/bookstore/account';

// demoqa.com/login. DemoQA shows many ads; they are blocked so the page loads fast and the
// buttons are not covered.
export class LoginPage {
  constructor(
    private readonly page: Page,
    private readonly baseUrl: string,
  ) {}

  async open() {
    await this.page.route(/googlesyndication|doubleclick|adservice|adplus/, (route) => route.abort());
    await this.page.goto(`${this.baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  }

  // Note: a UI login gives the account a new token, so a token got through the API before
  // this point stops working (DemoQA keeps only the newest token of an account).
  async logIn(credentials: Credentials) {
    await this.page.locator('#userName').fill(credentials.userName);
    await this.page.locator('#password').fill(credentials.password);
    await this.page.locator('#login').click();
    await this.page.waitForURL(/\/profile/);
  }
}
