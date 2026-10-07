import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? 4000);

const server = createServer((request, response) => {
  if (request.method === 'GET' && (request.url === '/health' || request.url === '/api/health')) {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok', service: 'rfp-orchestrator-api' }));
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
