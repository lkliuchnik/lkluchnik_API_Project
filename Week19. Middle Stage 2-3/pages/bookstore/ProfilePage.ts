import { Page } from '@playwright/test';

// demoqa.com/profile - the logged-in reader's name and their books.
export class ProfilePage {
  readonly userName;
  readonly bookLinks; // one link per book row, with the book title as text

  constructor(page: Page) {
    this.userName = page.locator('#userName-value');
    // by role, not by CSS class: DemoQA changed its table markup before (div-based -> <table>)
    this.bookLinks = page.getByRole('table').locator('tbody').getByRole('link');
  }
}
