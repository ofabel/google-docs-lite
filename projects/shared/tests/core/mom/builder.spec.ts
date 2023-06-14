import * as wodss from '@fhnw/wodss-shared';

describe('core.mom.Builder', () => {
  it('can build a dispatcher', async () => {
    const topicPrefix = `/test/${wodss.core.uid.slug()}/`;
    const clientId = wodss.core.uid.slug();

    const builder = new wodss.core.mom.Builder()
      .withClientId(clientId)
      .withTopicPrefix(topicPrefix);

    expect(builder).toBeInstanceOf(wodss.core.mom.Builder);

    const dispatcher = await builder.build()[1];

    expect(dispatcher).toBeInstanceOf(wodss.core.mom.Dispatcher);

    const destroy = dispatcher.destroy();

    await expect(destroy).resolves.toBeUndefined();
  });
});
