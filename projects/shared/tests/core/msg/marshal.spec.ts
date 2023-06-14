import * as wodss from '@fhnw/wodss-shared';
import * as pako from 'pako';

describe('core.msg.encode', () => {
  it('can encode a message object with all arguments set', () => {
    const messageId = wodss.core.uid.slug();
    const echoAllowed = true;
    const compress = true;
    const receiver = wodss.core.uid.slug();
    const ref = wodss.core.uid.slug();
    const replyTo = wodss.core.uid.slug();
    const body = {
      key: 'value'
    };

    function assertMessage(rawMessage: wodss.core.msg.RawMessage, compressed: boolean) {
      if (compressed) {
        expect(rawMessage.head.compress).toEqual('true');
      } else {
        expect(rawMessage.head.compress).toBeUndefined();
      }

      expect(rawMessage.head.echoAllowed).toEqual('true');
      expect(rawMessage.head.messageId).toEqual(messageId);
      expect(rawMessage.head.receiver).toEqual(receiver);
      expect(rawMessage.head.ref).toEqual(ref);
      expect(rawMessage.head.replyTo).toEqual(replyTo);
      expect(rawMessage.head.sender).toBeUndefined();
      expect(rawMessage.head.timestamp).toBeUndefined();
      expect(rawMessage.meta.contentType).toEqual('object');
      expect(rawMessage.body).toBeDefined();
      if (compressed) {
        expect(rawMessage.body).toBeInstanceOf(Uint8Array);
      } else {
        expect(rawMessage.body).toEqual(JSON.stringify(body));
      }
    }

    const builder = new wodss.core.msg.Builder()
      .withMessageId(messageId)
      .withCompress(compress)
      .withEchoAllowed(echoAllowed)
      .withReceiver(receiver)
      .withRef(ref)
      .withReplyTo(replyTo)
      .withBody(body);
    const compressedMessage = builder.build();

    const rawCompressedMessage = wodss.core.msg.encode(compressedMessage);

    assertMessage(rawCompressedMessage, true);

    const uncompressedMessage = builder.withCompress(undefined).build();

    const rawUncompressedMessage = wodss.core.msg.encode(uncompressedMessage);

    assertMessage(rawUncompressedMessage, false);
  });

  it('can encode a message object with partial arguments set', () => {
    const messageId = wodss.core.uid.slug();
    const body = undefined;

    const message = new wodss.core.msg.Builder()
      .withMessageId(messageId)
      .withBody(body)
      .build();

    const rawMessage = wodss.core.msg.encode(message);

    expect(rawMessage.head.compress).toBeUndefined();
    expect(rawMessage.head.echoAllowed).toBeUndefined();
    expect(rawMessage.head.messageId).toEqual(messageId);
    expect(rawMessage.head.receiver).toBeUndefined();
    expect(rawMessage.head.ref).toBeUndefined();
    expect(rawMessage.head.replyTo).toBeUndefined();
    expect(rawMessage.head.sender).toBeUndefined();
    expect(rawMessage.head.timestamp).toBeUndefined();
    expect(rawMessage.meta.contentType).toEqual('undefined');
    expect(rawMessage.body).toBe('');
  });
});

describe('core.msg.decode', () => {
  it('can decode a raw message object with all arguments set', () => {
    const topic = '/' + wodss.core.uid.slug();
    const qos = 1;
    const sender = wodss.core.uid.slug();
    const messageId = wodss.core.uid.slug();
    const echoAllowed = true;
    const compress = true;
    const receiver = wodss.core.uid.slug();
    const ref = wodss.core.uid.slug();
    const replyTo = wodss.core.uid.slug();
    const timestamp = '123';
    const body = {
      key: 'value'
    };
    const rawBody = Buffer.from(JSON.stringify(body));
    const payload = pako.deflate(rawBody) as Buffer;

    const message = wodss.core.msg.decode({
      contentType: 'object',
      topic: topic,
      qos: qos
    }, {
      compress: JSON.stringify(compress),
      echoAllowed: JSON.stringify(echoAllowed),
      messageId: messageId,
      receiver: receiver,
      ref: ref,
      replyTo: replyTo,
      sender: sender,
      timestamp: timestamp
    }, payload);

    expect(message.meta.contentType).toEqual('object');
    expect(message.meta.topic).toEqual(topic);
    expect(message.meta.qos).toEqual(qos);
    expect(message.head.compress).toEqual(compress);
    expect(message.head.echoAllowed).toEqual(echoAllowed);
    expect(message.head.messageId).toEqual(messageId);
    expect(message.head.receiver).toEqual(receiver);
    expect(message.head.ref).toEqual(ref);
    expect(message.head.replyTo).toEqual(replyTo);
    expect(message.head.sender).toEqual(sender);
    expect(message.head.timestamp).toEqual(123);
    expect(message.body).toEqual(body);
  });

  it('can decode a raw message object with partial arguments set', () => {
    const topic = '/' + wodss.core.uid.slug();
    const qos = 1;
    const sender = wodss.core.uid.slug();
    const messageId = wodss.core.uid.slug();
    const body = undefined;
    const payload = Buffer.from('');

    const message = wodss.core.msg.decode({
      contentType: 'undefined',
      topic: topic,
      qos: qos
    }, {
      messageId: messageId,
      sender: sender,
    }, payload);

    expect(message.meta.contentType).toEqual('undefined');
    expect(message.meta.topic).toEqual(topic);
    expect(message.meta.qos).toEqual(qos);
    expect(message.head.compress).toBeUndefined();
    expect(message.head.echoAllowed).toBeUndefined();
    expect(message.head.messageId).toEqual(messageId);
    expect(message.head.receiver).toBeUndefined();
    expect(message.head.ref).toBeUndefined();
    expect(message.head.replyTo).toBeUndefined();
    expect(message.head.timestamp).toBeUndefined();
    expect(message.head.sender).toEqual(sender);
    expect(message.body).toEqual(body);
  });
});
