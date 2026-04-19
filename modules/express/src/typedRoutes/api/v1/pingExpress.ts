import * as t from 'io-ts';
import { httpRoute, httpRequest } from '@api-ts/io-ts-http';
import { BitgoExpressError } from '../../schemas/error';

/**
 * Ping Express (v1)
 *
 * Ping bitgo express to ensure that it is still running. Unlike /ping, this does not try connecting to bitgo.com.
 *
 * @operationId express.v1.ping
 * @tag Express
 */
export const GetV1PingExpress = httpRoute({
  path: '/api/v1/pingexpress',
  method: 'GET',
  request: httpRequest({}),
  response: {
    200: t.type({ status: t.string }),
    404: BitgoExpressError,
  },
});
