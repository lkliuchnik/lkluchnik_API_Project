// An ISBN that is not in the DemoQA catalog. Used by the negative, bulk and error tests.
export const UNKNOWN_ISBN = '0000000000';

// DemoQA's own error texts for a new account (POST /Account/v1/User), word for word.
// Used by the password table and the error consistency tests.
export const PASSWORD_TOO_WEAK_MESSAGE =
  "Passwords must have at least one non alphanumeric character, one digit ('0'-'9'), one uppercase ('A'-'Z'), " +
  "one lowercase ('a'-'z'), one special character and Password must be eight characters or longer.";
export const LOGIN_DATA_MISSING_MESSAGE = 'UserName and Password required.';
