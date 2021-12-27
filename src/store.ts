import { Action, compose, createStore, Store, StoreEnhancer } from "redux";
import { install, combineReducers, LoopReducer } from "redux-loop";
import { appReducer } from "./App";

const composeEnhancers: typeof compose = (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

interface ReduxLoopStoreCreator {
  <S, A extends Action>(
    reducer: LoopReducer<S, A>,
    enhancer: StoreEnhancer<S>
  ): Store<S>;
}

const enhancedCreateStore = createStore as ReduxLoopStoreCreator;

export const store = enhancedCreateStore(
  combineReducers({
    app: appReducer,
  }),
  composeEnhancers(
    install(),
  ),
);