import Actordsa5 from '../actor/actor-dsa5.js';

export function setActorDelta() {
  const oldUpdate = ActorDelta._onUpdateOperation;
  ActorDelta._onUpdateOperation = async (documents, operation, user) => {
    for (let doc of documents) {
      await Actordsa5.postUpdateConditions(doc.syntheticActor);
    }
    return oldUpdate(documents, operation, user);
  };

  const oldCreate = ActorDelta._onCreateOperation;
  ActorDelta._onCreateOperation = async (documents, operation, user) => {
    for (let doc of documents) {
      await Actordsa5.postUpdateConditions(doc.syntheticActor);
    }
    return oldCreate(documents, operation, user);
  };
}
