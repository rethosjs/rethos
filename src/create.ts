import { useMemo } from 'react';
import { useForceUpdate } from './hooks/use-force-update';
import { TState, TAction, ExtractAction, SingleStore } from './lib/single-store';
import { isObject } from './utils/is-object';

type Id = string | symbol;

type StoreMap<S extends TState, A extends TAction<S>> = { [key: Id]: SingleStore<S, A> };

/**
 * Create A Store
 *
 * @param {Object} state a object represent the state, MUST BE A OBJECT!!
 * @param {TAction} action a collection of action that change the state in the store
 * @returns [useState, useAction]
 */
export function createStore<S extends TState, A extends TAction<S>>(state: S, action?: A): [(id?: Id) => S, (id?: Id) => ExtractAction<A>] {
  if (!isObject(state)) {
    throw new Error('object required');
  }

  const storeMap: StoreMap<S, A> = {};

  let defaultStore: SingleStore<S, A>;

  /**
   * Lazy init & get store by id
   *
   * @param id
   * @returns
   */
  const getStore = (id?: Id) => {
    if (id) {
      let store = storeMap[id];
      if (!store) {
        let store = new SingleStore<S, A>(state, action);
        storeMap[id] = store;
      }
      return store;
    }

    if (!defaultStore) {
      defaultStore = new SingleStore<S, A>(state, action);
    }

    return defaultStore;
  };

  /**
   * State Hook
   *
   * @param id
   * @returns
   */
  const useState = (id?: Id) => {
    const forceUpdate = useForceUpdate();

    const state = useMemo(() => {
      const store = getStore(id);
      return store.getState(forceUpdate);
    }, [id, forceUpdate]);

    return state;
  };

  /**
   * Get Action
   *
   * @param id
   * @returns
   */
  const getActions = (id?: Id) => {
    const action = getStore(id).getAction();
    return action;
  };

  return [useState, getActions];
}
