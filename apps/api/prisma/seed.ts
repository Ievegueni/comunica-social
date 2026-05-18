import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);

  // Tenant: Futurix
  const futurix = await prisma.tenant.upsert({
    where: { slug: 'futurix' },
    update: {},
    create: {
      name: 'Futurix',
      slug: 'futurix',
      country: 'AO',
      approvalRequired: false,
      aiGenerationEnabled: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@futurix.ao' },
    update: { isSuperAdmin: true },
    create: {
      tenantId: futurix.id,
      email: 'admin@futurix.ao',
      passwordHash,
      name: 'Admin Futurix',
      role: 'OWNER',
      isSuperAdmin: true,
      status: 'ACTIVE',
    },
  });

  // Tenant: COMUNICA
  const comunica = await prisma.tenant.upsert({
    where: { slug: 'comunica' },
    update: {},
    create: {
      name: 'COMUNICA',
      slug: 'comunica',
      country: 'AO',
      approvalRequired: true,
      aiGenerationEnabled: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@comunica.ao' },
    update: {},
    create: {
      tenantId: comunica.id,
      email: 'admin@comunica.ao',
      passwordHash,
      name: 'Admin COMUNICA',
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });

  console.log('Seed completed:');
  console.log('  - Futurix:  admin@futurix.ao / ChangeMe123!');
  console.log('  - COMUNICA: admin@comunica.ao / ChangeMe123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
