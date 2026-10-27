import { test, expect } from '../../fixtures/petstore.fixture';
import { expectPetStoreError } from '../../assertions/petstore/errorAssertions';
import { imageFile, TINY_PNG } from '../../test-data/petstore/files';
import { uniqueId } from '../../test-data/petstore/petFactory';
import { HttpStatus } from '../../test-data/httpStatus';
import { Tag } from '../../config/tags';

// Multipart/form-data: POST /pet/{petId}/uploadImage takes a form with two parts -
// "file" (the image, required) and "additionalMetadata" (a description, optional) - instead
// of a JSON body. The PetStore answers with what it understood:
//   "additionalMetadata: <text or null>\nFile uploaded to ./<file name>, <size> bytes".
// Where the PetStore answers differently from a correct API, the case is marked test.fail -
// see assertion-notes.txt.

function uploadedMessage(metadata: string | null, fileName: string, size: number) {
  return `additionalMetadata: ${metadata}\nFile uploaded to ./${fileName}, ${size} bytes`;
}

test.describe('Multipart upload: a correct form', { tag: Tag.REGRESSION }, () => {
  test('a file with a description: the answer names the file, its size and the description', { tag: Tag.SMOKE }, async ({
    petstore,
    pet,
  }) => {
    const form = new FormData();
    form.append('additionalMetadata', 'front view');
    form.append('file', imageFile('qa-photo.png'));

    const { status, body } = await petstore.pets.uploadImage(pet.id, form);

    expect(status).toBe(HttpStatus.OK);
    expect(body.message).toBe(uploadedMessage('front view', 'qa-photo.png', TINY_PNG.length));
  });

  test('the description is optional: a file alone is uploaded', async ({ petstore, pet }) => {
    const form = new FormData();
    form.append('file', imageFile('qa-photo.png'));

    const { status, body } = await petstore.pets.uploadImage(pet.id, form);

    expect(status).toBe(HttpStatus.OK);
    expect(body.message).toBe(uploadedMessage(null, 'qa-photo.png', TINY_PNG.length));
  });
});

test.describe('Multipart upload: a wrong form', { tag: Tag.REGRESSION }, () => {
  // known deviation: 500 with an HTML error page - a form without its required part is a client error
  test.fail('without the file part the request is rejected with 400', async ({ petstore, pet }) => {
    const form = new FormData();
    form.append('additionalMetadata', 'front view');

    const response = await petstore.pets.uploadImage(pet.id, form);

    await expectPetStoreError(response, { status: HttpStatus.BAD_REQUEST });
  });

  // known deviation: 500 with an HTML error page
  test.fail('a file sent under another field name is rejected with 400', async ({ petstore, pet }) => {
    const form = new FormData();
    form.append('image', imageFile('qa-photo.png'));

    const response = await petstore.pets.uploadImage(pet.id, form);

    await expectPetStoreError(response, { status: HttpStatus.BAD_REQUEST });
  });

  // known deviation: the status is right (415 Unsupported Media Type), but the body has no message
  test.fail('a JSON body instead of a form is rejected with 415 and a normal error answer', async ({
    petstore,
    pet,
  }) => {
    const response = await petstore.pets.uploadImageAsJson(pet.id, { file: 'qa-photo.png' });

    await expectPetStoreError(response, { status: HttpStatus.UNSUPPORTED_MEDIA_TYPE });
  });

  // known deviation: 200 - the file is "uploaded" to a pet that does not exist
  test.fail('a file for a pet that does not exist is rejected with 404', async ({ petstore }) => {
    const form = new FormData();
    form.append('file', imageFile('qa-photo.png'));

    const response = await petstore.pets.uploadImage(uniqueId(), form);

    await expectPetStoreError(response, { status: HttpStatus.NOT_FOUND });
  });

  // known deviation: the answer takes the NAME of the second file and the SIZE of the first
  test.fail('two files in the "file" field: the answer does not mix them up', async ({ petstore, pet }) => {
    const form = new FormData();
    form.append('file', imageFile('first.png')); // 68 bytes
    form.append('file', imageFile('second.png', Buffer.alloc(0))); // 0 bytes

    const response = await petstore.pets.uploadImage(pet.id, form);

    // a correct API either refuses two files, or reports one of them as it is
    if (response.status === HttpStatus.OK) {
      expect([
        uploadedMessage(null, 'first.png', TINY_PNG.length),
        uploadedMessage(null, 'second.png', 0),
      ]).toContain(response.body.message);
    } else {
      await expectPetStoreError(response, { status: HttpStatus.BAD_REQUEST });
    }
  });
});
