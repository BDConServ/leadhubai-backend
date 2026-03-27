// prisma/seed.ts
import { PrismaClient, LeadSource, LeadStatus, MessageDirection } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 12);

  // Account
  const account = await prisma.account.upsert({
    where:  { id: 'seed-account-001' },
    update: {},
    create: {
      id: 'seed-account-001', name: 'Acme Roofing',
      businessType: 'roofing', autoReply: false,
    },
  });

  // User
  await prisma.user.upsert({
    where:  { email: 'owner@acmeroofing.com' },
    update: {},
    create: {
      email: 'owner@acmeroofing.com', passwordHash,
      role: 'OWNER', accountId: account.id,
    },
  });

  // Phone number
  await prisma.phoneNumber.upsert({
    where:  { number: '+18005550100' },
    update: {},
    create: { number: '+18005550100', sid: 'PN_seed_test', accountId: account.id },
  });

  // Leads
  const leads = await Promise.all([
    prisma.lead.upsert({
      where: { id: 'seed-lead-001' }, update: {},
      create: { id:'seed-lead-001', name:'John Martinez', phone:'+17275550001',
                service:'Roof inspection', source:LeadSource.FB_FORM,
                status:LeadStatus.REPLIED, accountId:account.id },
    }),
    prisma.lead.upsert({
      where: { id: 'seed-lead-002' }, update: {},
      create: { id:'seed-lead-002', name:'Sarah Thompson', phone:'+17275550002',
                service:'AC repair', source:LeadSource.IG_DM,
                status:LeadStatus.CONTACTED, accountId:account.id },
    }),
    prisma.lead.upsert({
      where: { id: 'seed-lead-003' }, update: {},
      create: { id:'seed-lead-003', name:'Mike Chen', phone:'+18135550003',
                service:'Full roof replacement', source:LeadSource.FB_DM,
                status:LeadStatus.NEW, accountId:account.id },
    }),
  ]);

  // Messages for John
  await prisma.message.createMany({
    skipDuplicates: true,
    data: [
      { id:'seed-msg-001', leadId:'seed-lead-001', body:'Hi, I need a roof inspection ASAP.', direction:MessageDirection.INBOUND },
      { id:'seed-msg-002', leadId:'seed-lead-001', body:"Hey John! Thanks for reaching out about your roof. Want a quick estimate or schedule an inspection?", direction:MessageDirection.OUTBOUND },
      { id:'seed-msg-003', leadId:'seed-lead-001', body:'Do you have availability this week?', direction:MessageDirection.INBOUND },
    ],
  });

  // Follow-ups for John
  const day1 = new Date(); day1.setDate(day1.getDate() + 1);
  const day3 = new Date(); day3.setDate(day3.getDate() + 3);
  await prisma.followUp.createMany({
    skipDuplicates: true,
    data: [
      { id:'seed-fu-001', leadId:'seed-lead-001', body:"Just checking in — still looking to get your roof looked at?", scheduledAt:day1 },
      { id:'seed-fu-002', leadId:'seed-lead-001', body:"We're booking inspections this week — want me to reserve a spot?", scheduledAt:day3 },
    ],
  });

  console.log(`✅ Seeded: 1 account, 1 user, 3 leads`);
  console.log(`   Login: owner@acmeroofing.com / password123`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
