import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const ALL_PERMISSIONS: Record<string, boolean> = {
  'citizens.view': true,
  'citizens.create': true,
  'citizens.edit': true,
  'citizens.delete': true,
  'passports.view': true,
  'passports.issue': true,
  'passports.reissue': true,
  'laws.view': true,
  'laws.create': true,
  'laws.edit': true,
  'laws.repeal': true,
  'cases.view': true,
  'cases.create': true,
  'cases.manage': true,
  'cases.close': true,
  'punishments.view': true,
  'punishments.issue': true,
  'punishments.revoke': true,
  'taxes.view': true,
  'taxes.charge': true,
  'taxes.mark_paid': true,
  'treasury.view': true,
  'treasury.edit': true,
  'relict.view': true,
  'relict.create': true,
  'relict.edit': true,
  'relict.delete': true,
  'territories.view': true,
  'territories.manage': true,
  'diplomacy.view': true,
  'diplomacy.manage': true,
  'accounts.manage': true,
  'roles.manage': true,
  'chat.send': true,
}

const MINISTER_PERMISSIONS: Record<string, boolean> = {
  'citizens.view': true,
  'citizens.create': true,
  'citizens.edit': true,
  'passports.view': true,
  'passports.issue': true,
  'passports.reissue': true,
  'laws.view': true,
  'cases.view': true,
  'cases.create': true,
  'cases.manage': true,
  'cases.close': true,
  'punishments.view': true,
  'punishments.issue': true,
  'punishments.revoke': true,
  'taxes.view': true,
  'taxes.charge': true,
  'taxes.mark_paid': true,
  'treasury.view': true,
  'relict.view': true,
  'relict.create': true,
  'relict.edit': true,
  'territories.view': true,
  'territories.manage': true,
  'diplomacy.view': true,
  'chat.send': true,
}

const CITIZEN_PERMISSIONS: Record<string, boolean> = {
  'citizens.view': true,
  'passports.view': true,
  'laws.view': true,
  'cases.view': true,
  'punishments.view': true,
  'taxes.view': true,
  'treasury.view': true,
  'relict.view': true,
  'territories.view': true,
  'diplomacy.view': true,
  'chat.send': true,
}

async function main() {
  console.log('Seeding database...')

  const headRole = await prisma.role.upsert({
    where: { name: 'Глава государства' },
    update: {},
    create: {
      name: 'Глава государства',
      color: '#1B3A6B',
      is_system: true,
      permissions: ALL_PERMISSIONS,
    },
  })

  const ministerRole = await prisma.role.upsert({
    where: { name: 'Министр' },
    update: {},
    create: {
      name: 'Министр',
      color: '#10B981',
      is_system: false,
      permissions: MINISTER_PERMISSIONS,
    },
  })

  await prisma.role.upsert({
    where: { name: 'Гражданин' },
    update: {},
    create: {
      name: 'Гражданин',
      color: '#64748B',
      is_system: false,
      permissions: CITIZEN_PERMISSIONS,
    },
  })

  const passwordHash = await bcrypt.hash('admin123', 12)

  await prisma.user.upsert({
    where: { login: 'admin' },
    update: {},
    create: {
      login: 'admin',
      password_hash: passwordHash,
      role_id: headRole.id,
      is_active: true,
      must_change_password: true,
    },
  })

  const treasuryCount = await prisma.treasury.count()
  if (treasuryCount === 0) {
    await prisma.treasury.create({
      data: { balance: 0 },
    })
  }

  console.log('Seed completed successfully.')
  console.log(`Roles created: Глава государства, Министр, Гражданин`)
  console.log(`Admin user created: login=admin, password=admin123`)
  console.log(`Minister role id: ${ministerRole.id}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
