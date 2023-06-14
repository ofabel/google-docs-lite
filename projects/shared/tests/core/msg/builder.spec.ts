import * as wodss from '@fhnw/wodss-shared';

describe('core.msg.Builder', () => {
  it('can build a message object', () => {
    const messageId = wodss.core.uid.slug();
    const echoAllowed = true;
    const compress = true;
    const receiver = wodss.core.uid.slug();
    const ref = wodss.core.uid.slug();
    const replyTo = wodss.core.uid.slug();
    const body = {
      key: 'value'
    };

    const message = new wodss.core.msg.Builder()
      .withMessageId(messageId)
      .withCompress(compress)
      .withEchoAllowed(echoAllowed)
      .withReceiver(receiver)
      .withRef(ref)
      .withReplyTo(replyTo)
      .withBody(body)
      .build();

    expect(message.head.compress).toEqual(compress);
    expect(message.head.echoAllowed).toEqual(echoAllowed);
    expect(message.head.messageId).toEqual(messageId);
    expect(message.head.receiver).toEqual(receiver);
    expect(message.head.ref).toEqual(ref);
    expect(message.head.replyTo).toEqual(replyTo);
    expect(message.head.sender).toBeUndefined();
    expect(message.head.timestamp).toBeUndefined();
    expect(message.body).toEqual(body);
  });
});
