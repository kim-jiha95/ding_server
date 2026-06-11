const { RedisMemoryServer } = require('redis-memory-server');

async function main() {
  const server = new RedisMemoryServer({
    instance: { port: 6379, ip: '127.0.0.1' },
  });

  const host = await server.getHost();
  const port = await server.getPort();
  console.log(`redis-memory-server listening on redis://${host}:${port}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
