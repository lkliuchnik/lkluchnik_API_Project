// Files for the multipart upload tests, made in memory - nothing is read from disk.

// A real PNG image of 1 x 1 pixel (68 bytes).
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

// A file part for a multipart form: the bytes, the file name and the type.
export function imageFile(name: string, bytes: Buffer = TINY_PNG, type = 'image/png') {
  return new File([bytes], name, { type });
}
