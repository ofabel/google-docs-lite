import * as wodss from '@fhnw/wodss-shared';

describe('core.store.createStateFactory', () => {
  it('can create a fresh state from a factory', () => {
    const id = '440e884f-6be1-4b1f-bd69-48411a81d3e0';
    const type = '3df188f7-fd9e-454c-b1fd-25c3588083ef';
    const list = [{v: 1}, {v: 2}, {v: 3}];
    const object = {
      property: 'value'
    };

    const factory = wodss.core.store.createStateFactory(id => ({
      _id: id(),
      _type: '3df188f7-fd9e-454c-b1fd-25c3588083ef',
      _persist: true,
      property: 42 as number,
      someList: list,
      someObject: object,
      otherObject: {
        id: id()
      }
    }));

    expect(factory).toBeInstanceOf(wodss.core.store.StateTreeFactory);
    expect(factory.type).not.toBe(type);
    expect(factory.type).toBe(wodss.core.uid.slug(type));
    expect(factory.persist).toBe(true);

    const stateWithRandomId1 = factory.create();
    const stateWithRandomId2 = factory.create();
    const stateWithDefinedId1 = factory.create(id);
    const stateWithDefinedId2 = factory.create(id);

    expect(stateWithRandomId1).not.toEqual(stateWithRandomId2);
    expect(stateWithRandomId1._id).not.toBe(stateWithRandomId2._id);
    expect(stateWithRandomId1._type).toBe(stateWithRandomId2._type);
    expect(stateWithRandomId1._type).toBe(factory.type);

    expect(stateWithDefinedId1).not.toEqual(stateWithDefinedId2);
    expect(stateWithDefinedId1._id).toBe(stateWithDefinedId2._id);
    expect(stateWithDefinedId1._id).toBe(wodss.core.uid.slug(id));

    list.push({v: 4});
    object.property = 'other value';

    expect(stateWithRandomId1.someList.length).toBe(3);
    expect(stateWithRandomId1.someObject.property).toBe('value');
  });
});
