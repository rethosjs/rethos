import { isObject } from '../utils/is-object';
import { errors } from './error';
import { StoreStateUpdateTracker } from './store-state-update-tracker';

export type Primitive = bigint | boolean | null | number | string | symbol | undefined;
export type StateValue = Primitive | IStoreState | StateValueArray;

export interface StateValueArray extends Array<StateValue> {}

export interface IStoreState {
  [key: string]: StateValue;
}

/**
 * Single Store to mange the state and action
 */
export class StoreState<S extends IStoreState> {
  /**
   * The original(default) state object.
   * - This object mainly used as the "identifier"
   * - NEVER change the value in any proxy
   */
  originalState: any;

  /**
   * state -> propKey -> <update func> set
   */
  observableUpdateMap = new WeakMap<any, Map<any, Set<any>>>();

  /**
   * array -> <update func> set
   */
  observableArrayUpdateMap = new WeakMap<any, Set<any>>();

  /**
   * update func -> set of prop key set
   */
  updateToPropKeySetMap = new WeakMap<any, Set<any>>();

  /**
   * update func -> obj -> proxy
   */
  rawToProxyMap = new WeakMap<any, WeakMap<any, any>>();

  /**
   * collect the "update func" in an action
   */
  updateCollectionSet = new Set<any>();

  constructor(state: S, private tracker: StoreStateUpdateTracker) {
    this.originalState = state;
    this.observableUpdateMap.set(state, new Map());
  }

  /**
   * Get Subscribable State
   *
   * @param updateFunc Called when the subscribed prop value changed; also it can be considered as identifier
   * @returns
   */
  getSubscribableState(updateFunc?: () => void) {
    const proxyState = this.getProxyState(this.originalState, updateFunc);
    return proxyState;
  }

  /**
   * Get State that can be changed in action
   */
  getChangableState() {
    const proxyState = this.createProxyStateInAction(this.originalState);
    return proxyState;
  }

  /**
   * Clean the unused subscribed function
   *
   * @param updateFunc func subscribted to the state
   */
  cleanUpdate(updateFunc: () => void) {
    const updateFuncSet = this.updateToPropKeySetMap.get(updateFunc);
    updateFuncSet?.forEach((set: Set<any>) => {
      set.delete(updateFunc);
    });
    this.updateToPropKeySetMap.delete(updateFunc);
    this.rawToProxyMap.delete(updateFunc);
  }

  /**
   * Get Proxy State
   *
   * @param state
   * @param updateFunc
   * @returns
   */
  private getProxyState(state: S, updateFunc?: () => void) {
    let rawToProxyMap = this.rawToProxyMap.get(updateFunc);
    if (!rawToProxyMap) {
      rawToProxyMap = new WeakMap();
      this.rawToProxyMap.set(updateFunc, rawToProxyMap);
    }

    let proxyState = rawToProxyMap.get(state);
    if (!proxyState) {
      proxyState = this.createProxyState(state, updateFunc);
      rawToProxyMap.set(state, proxyState);
    }
    return proxyState;
  }

  /**
   * Proxy the Original State which is used in components
   *  - auto make state observable
   *  - auto collect state update in  action
   */
  private createProxyState(state: S, updateFunc?: () => void): S {
    return new Proxy(state, {
      get: (target: S, propKey: string, receiver) => {
        const isArray = Array.isArray(target);

        if (updateFunc) {
          this.tracker.trackUpdate(target, propKey, updateFunc);
        }

        if (isArray) {
          return target[propKey];
        }

        const originalValue = Reflect.get(target, propKey, receiver);
        if (isObject(originalValue)) {
          return this.createProxyState(originalValue, updateFunc) as any;
        }

        return originalValue;
      },
      set: () => {
        throw new Error(errors[1]);
      },
      defineProperty: () => {
        throw new Error(errors[1]);
      },
      deleteProperty: () => {
        throw new Error(errors[1]);
      },
    }) as S;
  }

  /**
   * Proxy the Original State Which only used in action as input params
   *
   * @param state
   * @returns
   */
  private createProxyStateInAction(state: S): S {
    return new Proxy(state, {
      get: (target: S, propKey: string, receiver) => {
        const value = Reflect.get(target, propKey, receiver);

        const isArray = Array.isArray(target);

        if (isArray) {
          return target[propKey];
        }

        if (isObject(value)) {
          return this.createProxyStateInAction(value) as any;
        }

        return value;
      },
      set: (target: S, propKey: string, value: any) => {
        const oldValue = Reflect.get(target, propKey);

        if (oldValue !== value) {
          Reflect.set(target, propKey, value);

          // collect the update
          this.tracker.collectUpdate(target, propKey);
        }

        return true;
      },
      deleteProperty: (target: S, propKey: string) => {
        const result = Reflect.deleteProperty(target, propKey);

        this.tracker.collectUpdate(target, propKey);

        return result;
      },
    });
  }
}