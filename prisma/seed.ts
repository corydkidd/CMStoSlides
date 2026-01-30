import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default Federal Register settings if not exists
  const existingSettings = await prisma.federalRegisterSettings.findFirst();

  if (!existingSettings) {
    await prisma.federalRegisterSettings.create({
      data: {
        isEnabled: true,
        pollIntervalMinutes: 15,
        agencySlugs: ['centers-for-medicare-medicaid-services'],
        documentTypes: ['RULE', 'PRORULE', 'NOTICE'],
        onlySignificant: false,
        autoProcessNew: true,
        initialized: false,
        initialDocumentCount: 5,
      },
    });
    console.log('Created default FederalRegisterSettings');
  } else {
    console.log('FederalRegisterSettings already exists, skipping');
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
