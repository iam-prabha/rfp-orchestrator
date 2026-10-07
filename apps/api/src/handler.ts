import type { IncomingMessage, ServerResponse } from 'node:http';

export default function handler(_request: IncomingMessage, response: ServerResponse) {
  response.setHeader('content-type', 'application/json');
  response.statusCode = 200;
  response.end(JSON.stringify({ status: 'ok', service: 'rfp-orchestrator-api' }));
}
