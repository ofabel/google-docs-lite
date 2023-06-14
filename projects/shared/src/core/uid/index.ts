// eslint-disable-next-line
// @ts-ignore
import * as slugid from 'slugid';
import * as uuid from 'uuid';
import * as uid from 'uid'; // TODO maybe replace with own implementation

export function nice(): string {
  return slugid.nice();
}

export function slug(uuidToSlugOrV5Name?: string, namespace?: string): string {
  if (!uuidToSlugOrV5Name && !namespace) {
    return slugid.v4();
  }

  if (uuidToSlugOrV5Name && namespace) {
    const namespaceUuid = unslug(namespace);
    const uuidToSlug = uuid.v5(uuidToSlugOrV5Name, namespaceUuid);

    return slugid.encode(uuidToSlug);
  }

  if (uuidToSlugOrV5Name?.length === 22 && validate(uuidToSlugOrV5Name)) {
    return uuidToSlugOrV5Name;
  }

  return slugid.encode(uuidToSlugOrV5Name);
}

export function unslug(slug: string): string {
  try {
    return slugid.decode(slug);
  } catch (e) {
    if (!uuid.validate(slug)) {
      throw e;
    }

    return slug;
  }
}

export function parse(slugOrUuid: string): Uint8Array {
  const sureUuid = unslug(slugOrUuid);

  return uuid.parse(sureUuid) as Uint8Array;
}

export function full(name?: string, namespace?: string) {
  return name && namespace ? uuid.v5(name, namespace) : uuid.v4();
}

export function short(length = 16) {
  return uid.uid(length);
}

export function validate(strToVerify: string): boolean {
  let uuidToValidate;
  try {
    uuidToValidate = slugid.decode(strToVerify);
  } catch (e) {
    uuidToValidate = strToVerify;
  }

  return uuid.validate(uuidToValidate);
}

export function compare(left: string, right: string): number {
  const leftUuid = parse(left);
  const rightUuid = parse(right);

  for (let i = 0; i < leftUuid.length; i++) {
    const diff = leftUuid[i] - rightUuid[i];

    if (diff != 0) {
      return diff;
    }
  }

  return 0;
}
