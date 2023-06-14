import * as core from '@syncedstore/core';
import * as wodss from '@fhnw/wodss-shared';

describe('core.store.encode', () => {
  const factory = wodss.core.store.createStateFactory(() => ({
    _id: '86ca312e-04c4-4ce9-8f9e-c8dae516441e',
    _type: 'c27efa33-f400-402e-83ee-859daa183ed3',
    _persist: true,
    property: 'some text',
    object: {
      attribute: 'some other text'
    }
  }));

  const encodedState = {
    "_id": "jG-g7TDxQ-qMhIdlrtgtoA",
    "_type": "8RWtr2EcRAmhB7CTtyXQEw",
    "_persist": true,
    "order": {
      "_id": "PbmbNrb1ReSG9inzitUKZg",
      "value": [
        {
          "id": "ylYs2qP3QZqphQ9MO9a5dQ"
        }
      ]
    },
    "paragraphs": {
      "ylYs2qP3QZqphQ9MO9a5dQ": {
        "_id": "ylYs2qP3QZqphQ9MO9a5dQ",
        "value": {
          "_id": "ylYs2qP3QZqphQ9MO9a5dQ",
          "lastModified": "Thu, 28 Apr 2022 17:36:04 GMT",
          "lastModifiedBy": "dRF6yOGUWaaiZIn-r822EA",
          "text": {
            "_8ibG_8r7Qm2EO3gqgG1HRQ": [
              {
                "nodeName": "paragraph",
                "attributes": {},
                "children": [
                  {
                    "text": [
                      {
                        "insert": "asdf "
                      },
                      {
                        "insert": "asdfas",
                        "attributes": {
                          "bold": {},
                          "italic": {},
                          "strike": {}
                        }
                      },
                      {
                        "insert": " fasfa sdf asfa sfas f"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      }
    }
  };

  it('can encode a state tree', () => {
    const state = factory.create();

    const encodedState = wodss.core.store.encode(state);

    expect(encodedState).toEqual({
      _id: 'hsoxLgTETOmPnsja5RZEHg',
      _type: 'wn76M_QAQC6D7oWdqhg-0w',
      _persist: true,
      property: 'some text',
      object: {
        attribute: 'some other text'
      }
    });
  });

  it('can decode a state tree', () => {
    const decodedState = wodss.core.store.decode(encodedState);
    const store = core.syncedStore({state: {}});
    const state = Object.assign(store.state, decodedState);
    const clone = wodss.core.util.deepClone(state);

    expect(clone).toEqual({
      "_id": "jG-g7TDxQ-qMhIdlrtgtoA",
      "_type": "8RWtr2EcRAmhB7CTtyXQEw",
      "_persist": true,
      "order": {
        "_id": "PbmbNrb1ReSG9inzitUKZg",
        "value": [
          {
            "id": "ylYs2qP3QZqphQ9MO9a5dQ"
          }
        ]
      },
      "paragraphs": {
        "ylYs2qP3QZqphQ9MO9a5dQ": {
          "_id": "ylYs2qP3QZqphQ9MO9a5dQ",
          "value": {
            "_id": "ylYs2qP3QZqphQ9MO9a5dQ",
            "lastModified": "Thu, 28 Apr 2022 17:36:04 GMT",
            "lastModifiedBy": "dRF6yOGUWaaiZIn-r822EA",
            "text": "<paragraph>asdf <bold><italic><strike>asdfas</strike></italic></bold> fasfa sdf asfa sfas f</paragraph>"
          }
        }
      }
    });

    const reEncodedState = wodss.core.store.encode(state);

    expect(reEncodedState).toEqual(encodedState);
  });
});
