import * as wodss from '@fhnw/wodss-shared';

describe('core.uid', () => {
  const niceUuidRegex = /[A-Za-f][A-Za-z0-9_-]{7}[Q-T][A-Za-z0-9_-][CGKOSWaeimquy26-][A-Za-z0-9_-]{10}[AQgw]/;
  const slugUuidRegex = /[A-Za-z0-9_-]{8}[Q-T][A-Za-z0-9_-][CGKOSWaeimquy26-][A-Za-z0-9_-]{10}[AQgw]/;
  const uuid4Regex = /[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89aAbB][a-f0-9]{3}-[a-f0-9]{12}/;

  it.each([
    wodss.core.uid.nice(),
    wodss.core.uid.nice(),
    wodss.core.uid.nice(),
    wodss.core.uid.nice()
  ])('can verify that %s is a nice slug UUID', slug => {
    expect(slug).toMatch(niceUuidRegex);
  });

  it.each([
    wodss.core.uid.slug(),
    wodss.core.uid.slug(),
    wodss.core.uid.slug(),
    wodss.core.uid.slug()
  ])('can verify that %s is a valid slug UUID', slug => {
    expect(slug).toMatch(slugUuidRegex);
  });

  it.each([
    ['985a9887-3c58-40b5-9bb6-38b4a7145180', 'mFqYhzxYQLWbtji0pxRRgA'],
    ['c0ffb416-b057-4717-ae92-fdbacdd14f3c', 'wP-0FrBXRxeukv26zdFPPA'],
    ['ff20de09-ae4d-4864-ab32-ac04f4604b59', '_yDeCa5NSGSrMqwE9GBLWQ'],
    ['94ba6833-270c-4192-963c-5b553af87a27', 'lLpoMycMQZKWPFtVOvh6Jw'],
    ['lLpoMycMQZKWPFtVOvh6Jw', 'lLpoMycMQZKWPFtVOvh6Jw'],
    ['_yDeCa5NSGSrMqwE9GBLWQ', '_yDeCa5NSGSrMqwE9GBLWQ'],
    ['wP-0FrBXRxeukv26zdFPPA', 'wP-0FrBXRxeukv26zdFPPA'],
  ])('can generate a slug from %s', (uuid, expectedSlug) => {
    const slug = wodss.core.uid.slug(uuid);

    expect(slug).toEqual(expectedSlug);
  });

  it.each([
    'W8JLFeyqWBrv7GYPRn4fqwQENvHq6gA6ryei',
    'xMzAxzJqLxLX6ATTDJiPdhkLnk5M3PQyW95z',
    'ex7XV6C7uXpr9QXZ7WicEjZLiaJn58A3dAuZ',
    'zVPqGj3S9HNvZJ326gMGN5jhgSE968umyLhu'
  ])('cannot generate a slug from %s', (randomString) => {
    expect(1);

    try {
      wodss.core.uid.slug(randomString);
    } catch (e) {
      expect(e).toBeInstanceOf(TypeError);
    }
  });

  it.each([
    ['W8JLFeyqWBrv7GYPRn4fqwQENvHq6gA6ryei', '985a9887-3c58-40b5-9bb6-38b4a7145180', '_9IibwPdU96x0kGrGfzzHQ'],
    ['xMzAxzJqLxLX6ATTDJiPdhkLnk5M3PQyW95z', 'c0ffb416-b057-4717-ae92-fdbacdd14f3c', 'MP9YvEvOW2OPJuJDAFQjJQ'],
    ['ex7XV6C7uXpr9QXZ7WicEjZLiaJn58A3dAuZ', 'ff20de09-ae4d-4864-ab32-ac04f4604b59', '0ws8rxkWVQCLjOV62ppvFw'],
    ['zVPqGj3S9HNvZJ326gMGN5jhgSE968umyLhu', '94ba6833-270c-4192-963c-5b553af87a27', '8LINMbUcVxapQHWKp6JYqw'],
    ['ex7XV6C7uXpr9QXZ7WicEjZLiaJn58A3dAuZ', '_yDeCa5NSGSrMqwE9GBLWQ', '0ws8rxkWVQCLjOV62ppvFw'],
    ['zVPqGj3S9HNvZJ326gMGN5jhgSE968umyLhu', 'lLpoMycMQZKWPFtVOvh6Jw', '8LINMbUcVxapQHWKp6JYqw'],
  ])('can generate a UUID v5 slug from %s with namespace %s', (name, namespace, expectedSlug) => {
    const slug = wodss.core.uid.slug(name, namespace);

    expect(slug).toEqual(expectedSlug);
  });

  it.each([
    ['mFqYhzxYQLWbtji0pxRRgA', '985a9887-3c58-40b5-9bb6-38b4a7145180'],
    ['wP-0FrBXRxeukv26zdFPPA', 'c0ffb416-b057-4717-ae92-fdbacdd14f3c'],
    ['_yDeCa5NSGSrMqwE9GBLWQ', 'ff20de09-ae4d-4864-ab32-ac04f4604b59'],
    ['lLpoMycMQZKWPFtVOvh6Jw', '94ba6833-270c-4192-963c-5b553af87a27'],
    ['fd1102ec-dca1-4723-8179-16eb3fce3ec1', 'fd1102ec-dca1-4723-8179-16eb3fce3ec1'],
    ['7e9a7899-f325-406b-a3f2-96efa277a108', '7e9a7899-f325-406b-a3f2-96efa277a108'],
    ['2fe11664-ac04-4f4c-8658-9ac46fbd432a', '2fe11664-ac04-4f4c-8658-9ac46fbd432a'],
    ['d22a773e-bcbc-45a8-ba09-5da7dd9677a6', 'd22a773e-bcbc-45a8-ba09-5da7dd9677a6'],
  ])('can unslug %s to %s', (slug, expectedUuid) => {
    const uuid = wodss.core.uid.unslug(slug);

    expect(uuid).toEqual(expectedUuid);
  });

  it.each([
    'W8JLFeyqWBrv7GYPRn4fqwQENvHq6gA6ryei',
    'xMzAxzJqLxLX6ATTDJiPdhkLnk5M3PQyW95z',
    'ex7XV6C7uXpr9QXZ7WicEjZLiaJn58A3dAuZ',
    'zVPqGj3S9HNvZJ326gMGN5jhgSE968umyLhu'
  ])('cannot unslug %s to a UUID', (randomString) => {
    expect(1);

    try {
      wodss.core.uid.unslug(randomString);
    } catch (e) {
      expect(e).toBeInstanceOf(TypeError);
    }
  });

  it.each([
    wodss.core.uid.full(),
    wodss.core.uid.full(),
    wodss.core.uid.full(),
    wodss.core.uid.full(),
    wodss.core.uid.full()
  ])('can verify that %s is a random v4 UUID', (uuid) => {
    expect(uuid).toMatch(uuid4Regex);
  });

  it.each([
    ['W8JLFeyqWBrv7GYPRn4fqwQENvHq6gA6ryei', '985a9887-3c58-40b5-9bb6-38b4a7145180', 'ffd2226f-03dd-53de-b1d2-41ab19fcf31d'],
    ['xMzAxzJqLxLX6ATTDJiPdhkLnk5M3PQyW95z', 'c0ffb416-b057-4717-ae92-fdbacdd14f3c', '30ff58bc-4bce-5b63-8f26-e24300542325'],
    ['ex7XV6C7uXpr9QXZ7WicEjZLiaJn58A3dAuZ', 'ff20de09-ae4d-4864-ab32-ac04f4604b59', 'd30b3caf-1916-5500-8b8c-e57ada9a6f17'],
    ['zVPqGj3S9HNvZJ326gMGN5jhgSE968umyLhu', '94ba6833-270c-4192-963c-5b553af87a27', 'f0b20d31-b51c-5716-a940-758aa7a258ab']
  ])('can generate a UUID v5 from %s with namespace %s', (name, namespace, expectedUuid) => {
    const uuid = wodss.core.uid.full(name, namespace);

    expect(uuid).toEqual(expectedUuid);
  });

  it.each([
    [wodss.core.uid.short(), 16],
    [wodss.core.uid.short(16), 16],
    [wodss.core.uid.short(42), 42],
    [wodss.core.uid.short(8), 8],
    [wodss.core.uid.short(13), 13],
  ])('can verify that %s is a valid short ID of length %d', (uid, expectedLength) => {
    expect(uid).toHaveLength(expectedLength);
  });

  it.each([
    ['mFqYhzxYQLWbtji0pxRRgA', true],
    ['wP-0FrBXRxeukv26zdFPPA', true],
    ['_yDeCa5NSGSrMqwE9GBLWQ', true],
    ['lLpoMycMQZKWPFtVOvh6Jw', true],
    ['985a9887-3c58-40b5-9bb6-38b4a7145180', true],
    ['ffd2226f-03dd-53de-b1d2-41ab19fcf31d', true],
    ['ff20de09-ae4d-4864-ab32-ac04f4604b59', true],
    ['94ba6833-270c-4192-963c-5b553af87a27', true],
    ['W8JLFeyqWBrv7GYPRn4fqwQENvHq6gA6ryei', false],
    ['xMzAxzJqLxLX6ATTDJiPdhkLnk5M3PQyW95z', false],
    ['ex7XV6C7uXpr9QXZ7WicEjZLiaJn58A3dAuZ', false],
    ['zVPqGj3S9HNvZJ326gMGN5jhgSE968umyLhu', false]
  ])('can verify that %s is (not) a valid UUID or slug', (uuidOrSlug: string, expectedValidity: boolean) => {
    const isValid = wodss.core.uid.validate(uuidOrSlug);

    expect(isValid).toEqual(expectedValidity);
  });

  it.each([
    ['wP-0FrBXRxeukv26zdFPPA', '985a9887-3c58-40b5-9bb6-38b4a7145180', 40],
    ['mFqYhzxYQLWbtji0pxRRgA', 'c0ffb416-b057-4717-ae92-fdbacdd14f3c', -40],
    ['lLpoMycMQZKWPFtVOvh6Jw', 'ff20de09-ae4d-4864-ab32-ac04f4604b59', -107],
    ['_yDeCa5NSGSrMqwE9GBLWQ', '94ba6833-270c-4192-963c-5b553af87a27', 107],
    ['wP-0FrBXRxeukv26zdFPPA', 'c0ffb416-b057-4717-ae92-fdbacdd14f3c', 0],
    ['94ba6833-270c-4192-963c-5b553af87a27', '94ba6833-270c-4192-963c-5b553af87a27', 0],
    ['lLpoMycMQZKWPFtVOvh6Jw', 'lLpoMycMQZKWPFtVOvh6Jw', 0],
    ['94ba6833-270c-4192-963c-5b553af87a27', 'ff20de09-ae4d-4864-ab32-ac04f4604b59', -107],
  ])('can verify that comparison of %s and %s equals %d', (left: string, right: string, expectedDiff: number) => {
    const diff = wodss.core.uid.compare(left, right);

    expect(diff).toEqual(expectedDiff);
  });
});
