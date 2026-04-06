import type { Config, ClientOptions } from './client';
import type { ClientOptions as ClientOptions2 } from './types.gen';

export const createClientConfig = (override?: Config<ClientOptions & ClientOptions2>): Config<Required<ClientOptions> & ClientOptions2> => {
  return override as Config<Required<ClientOptions> & ClientOptions2>;
};
