import * as wodss from '@fhnw/wodss-shared';

describe('core.mom.Dispatcher', () => {
  const simpleTestTopic = `/wodss/mom/public/${wodss.core.uid.slug()}`;
  const requestTopic = `/wodss/mom/public/${wodss.core.uid.slug()}/request`;
  const responseTopic = `/wodss/mom/public/${wodss.core.uid.slug()}/response`;
  const clientId1 = wodss.core.uid.slug();
  const clientId2 = wodss.core.uid.slug();
  const topicPrefix = `/test/${wodss.core.uid.slug()}/`;

  it('can exchange simple messages between two dispatchers', done => {
    expect.assertions(24);

    const simpleMessageId = wodss.core.uid.slug();
    const roundTripMessageId = wodss.core.uid.slug();
    const message = {
      key: 'value',
      arr: [1, 2, 3, 4, 5],
      nested: {
        value: true
      }
    };

    const builder1 = new wodss.core.mom.Builder()
      .withCompressionThreshold(-1) // disabled
      .withClientId(clientId1)
      .withTopicPrefix(topicPrefix);

    const builder2 = new wodss.core.mom.Builder()
      .withCompressionThreshold(-1) // disabled
      .withClientId(clientId2)
      .withTopicPrefix(topicPrefix);

    expect(builder1).toBeInstanceOf(wodss.core.mom.Builder);
    expect(builder2).toBeInstanceOf(wodss.core.mom.Builder);

    const dispatcher1 = builder1.build()[0];
    const dispatcher2 = builder2.build()[0];

    expect(dispatcher1).toBeInstanceOf(wodss.core.mom.Dispatcher);
    expect(dispatcher2).toBeInstanceOf(wodss.core.mom.Dispatcher);

    let echoDone = false;
    let receiveDone = false;
    let requestDone = false;
    let responseDone = false;

    const checkResult = async () => {
      if (!echoDone || !receiveDone || !requestDone || !responseDone) {
        return;
      }

      await dispatcher1.destroy();
      await dispatcher2.destroy();

      expect(echoDone).toBe(true);
      expect(receiveDone).toBe(true);
      expect(requestDone).toBe(true);
      expect(responseDone).toBe(true);

      done();
    };

    dispatcher1.subscribe({
      topic: simpleTestTopic,
      echoAllowed: true,
      onMessageReceive: ({head, body}) => {
        expect(head.sender).toEqual(clientId1);
        expect(head.messageId).toEqual(simpleMessageId);
        expect(head.timestamp).toBeGreaterThan(10000);
        expect(body).toEqual(message);

        receiveDone = true;

        checkResult();
      }
    }).then(() => {
      const request = new wodss.core.msg.Builder()
        .withTopic(simpleTestTopic)
        .withBody(message)
        .withMessageId(simpleMessageId)
        .withEchoAllowed(true)
        .build();

      dispatcher1.publish({
        message: request,
        onEcho: ({head, body}) => {
          expect(head.sender).toEqual(clientId1);
          expect(head.messageId).toEqual(simpleMessageId);
          expect(head.timestamp).toBeGreaterThan(10000);
          expect(body).toEqual(message);

          echoDone = true;

          checkResult();
        }
      });
    });

    dispatcher2.subscribe({
      topic: requestTopic,
      echoAllowed: false,
      onMessageReceive: async (request) => {
        expect(request.head.sender).toEqual(clientId1);
        expect(request.head.messageId).toEqual(roundTripMessageId);
        expect(request.head.replyTo).toEqual(responseTopic);
        expect(request.head.timestamp).toBeGreaterThan(10000);
        expect(request.body).toEqual(message);

        const response = wodss.core.msg.Builder.replyTo(request)
          .withReceiver(request.head.sender)
          .withBody(request.body)
          .build();

        await dispatcher2.publish(response);

        requestDone = true;

        await checkResult();
      }
    }).then(() => {
      dispatcher1.subscribe({
        topic: responseTopic,
        echoAllowed: false
      }).then(() => {
        const request = new wodss.core.msg.Builder()
          .withTopic(requestTopic)
          .withReplyTo(responseTopic)
          .withMessageId(roundTripMessageId)
          .withBody(message)
          .build();

        dispatcher1.publish({
          message: request,
          onResponse: async ({head, body}) => {
            expect(head.sender).toEqual(clientId2);
            expect(head.ref).toEqual(roundTripMessageId);
            expect(body).toEqual(message);

            responseDone = true;

            await checkResult();
          }
        });
      })
    })
  });

  it('can exchange complex messages between two dispatchers', done => {
    const senderId = wodss.core.uid.slug();
    const receiverId = wodss.core.uid.slug();
    const messages = new Map<string, any>([ // eslint-disable-line
      [wodss.core.uid.slug(), true],
      [wodss.core.uid.slug(), false],
      [wodss.core.uid.slug(), undefined],
      [wodss.core.uid.slug(), 'short text'],
      [wodss.core.uid.slug(), {
        key: 'value',
        arr: [1, 2, 3, 4, 5],
        nested: {
          value: true
        }
      }],
      [wodss.core.uid.slug(), new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])]
    ]);

    const senderBuilder = new wodss.core.mom.Builder()
      .withCompressionThreshold(0)
      .withClientId(senderId)
      .withTopicPrefix(topicPrefix);

    const receiverBuilder = new wodss.core.mom.Builder()
      .withCompressionThreshold(0)
      .withClientId(receiverId)
      .withTopicPrefix(topicPrefix);

    expect(senderBuilder).toBeInstanceOf(wodss.core.mom.Builder);
    expect(receiverBuilder).toBeInstanceOf(wodss.core.mom.Builder);

    const sender = senderBuilder.build()[0];
    const receiver = receiverBuilder.build()[0];

    expect(sender).toBeInstanceOf(wodss.core.mom.Dispatcher);
    expect(receiver).toBeInstanceOf(wodss.core.mom.Dispatcher);

    async function checkResults({head, body}: wodss.core.msg.Message<any>) { // eslint-disable-line
      expect(head.compress).toBe(true);
      expect(head.echoAllowed).toBe(false);

      const messageReference = head.sender === senderId ? head.messageId : head.ref as string;

      if (!messages.has(messageReference)) {
        expect(false).toBe(true); // fail
      }

      const expectedBody = messages.get(messageReference);

      expect(body).toEqual(expectedBody);

      if (head.sender === senderId) {
        const response = new wodss.core.msg.Builder()
          .withTopic(responseTopic)
          .withBody(expectedBody)
          .withEchoAllowed(false)
          .withReceiver(senderId)
          .withRef(head.messageId)
          .build();
        await receiver.publish(response);
      } else if (head.sender === receiverId) {
        messages.delete(messageReference);

        if (messages.size === 0) {
          await receiver.destroy();
          await sender.destroy();

          done();
        }
      }
    }

    Promise.all([
      sender.subscribe({
        topic: responseTopic
      }),
      receiver.subscribe({
        topic: requestTopic,
        onMessageReceive: message => checkResults(message)
      })
    ]).then(() => {
      for (const [id, body] of messages.entries()) {
        const request = new wodss.core.msg.Builder()
          .withTopic(requestTopic)
          .withMessageId(id)
          .withBody(body)
          .withEchoAllowed(false)
          .withReplyTo(responseTopic)
          .build();
        sender.publish({
          message: request,
          onResponse: response => checkResults(response)
        });
      }
    });
  });

  it('can set a timeout for onEcho and onReceive callbacks', async () => {
    const start = wodss.core.util.utc();

    const dispatcher = new wodss.core.mom.Builder()
      .withMinLatency(100)
      .withMaxLatency(100)
      .withTopicPrefix(topicPrefix)
      .build()[0];

    const request = new wodss.core.msg.Builder()
      .withTopic(requestTopic)
      .withReplyTo(responseTopic)
      .withEchoAllowed(true)
      .withMessageId(wodss.core.uid.slug())
      .withBody(42)
      .build();

    let errorHandlerCalled = 0;

    async function errorHandler(message: wodss.core.msg.Message<unknown>, error?: Error) {
      expect(message.head.messageId).toEqual(request.head.messageId);
      expect(message.body).toEqual(request.body);
      expect(message.head.sender).toEqual(dispatcher.clientId);
      expect(message.head.timestamp).toBeGreaterThanOrEqual(start);
      expect(error).toBeDefined();

      errorHandlerCalled++;
    }

    await dispatcher.subscribe({
      topic: requestTopic,
      echoAllowed: true
    });

    await dispatcher.subscribe({
      topic: responseTopic
    });

    await dispatcher.publish({
      message: request,
      onEcho: () => expect(false).toBeTruthy(), // fail
      onResponse: () => expect(false).toBeTruthy(), // fail
      onEchoTimeoutError: errorHandler,
      onEchoTimeout: 50,
      onResponseTimeoutError: errorHandler,
      onResponseTimeout: 100
    });

    await expect(wodss.core.util.waitUntil(() => errorHandlerCalled === 2, 1000)).resolves.toBeUndefined();

    // test if callback handlers can be canceled
    const result = await dispatcher.publish({
      message: request,
      onEcho: () => expect(false).toBeTruthy(), // fail
      onResponse: () => expect(false).toBeTruthy(), // fail
      onEchoTimeoutError: () => expect(false).toBeTruthy(),
      onEchoTimeout: 50,
      onResponseTimeoutError: () => expect(false).toBeTruthy(),
      onResponseTimeout: 100
    });

    result.cancel();

    await expect(dispatcher.destroy()).resolves.toBeUndefined();
  });
});
