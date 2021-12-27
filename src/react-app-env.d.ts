/// <reference types="react-scripts" />

import { store } from './store';

declare module "react-redux" {
  type _DefaultRootState = ReturnType<typeof store['getState']>;
  interface DefaultRootState extends _DefaultRootState {}
}