import type { Config, ClientOptions } from './generated-client/client';
import type { ClientOptions as ClientOptions2 } from './generated-client/types.gen';

export const createClientConfig = (override?: Config<ClientOptions & ClientOptions2>): Config<Required<ClientOptions> & ClientOptions2> => {
  return override as Config<Required<ClientOptions> & ClientOptions2>;
};
