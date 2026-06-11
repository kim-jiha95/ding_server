const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const [messages, threads, matches, encounters] = await prisma.$transaction([
      prisma.chatMessage.deleteMany(),
      prisma.chatThread.deleteMany(),
      prisma.match.deleteMany(),
      prisma.encounter.deleteMany(),
    ]);

    console.log('[reset-social-data] deleted', {
      messages: messages.count,
      threads: threads.count,
      matches: matches.count,
      encounters: encounters.count,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[reset-social-data] failed', error);
  process.exit(1);
});
