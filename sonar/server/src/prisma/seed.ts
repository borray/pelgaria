import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const prisma = new PrismaClient()

const ALL_PERMISSIONS: Record<string, boolean> = {
  'system.superadmin': true,
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
  'laws.delete': true,
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
  'accounts.manage': true,
  'roles.manage': true,
  'chat.send': true,
  'office.view': true,
  'office.create': true,
  'office.manage': true,
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
  'chat.send': true,
  'office.view': true,
  'office.create': true,
  'office.manage': true,
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

  // Пароль администратора берётся ТОЛЬКО из окружения. Хардкод запрещён.
  const adminLogin = process.env.ADMIN_LOGIN || 'admin'
  const existingAdmin = await prisma.user.findUnique({ where: { login: adminLogin } })

  if (existingAdmin) {
    console.log(`Admin user "${adminLogin}" already exists — password not changed.`)
  } else {
    let adminPassword = process.env.ADMIN_PASSWORD
    let generated = false
    if (!adminPassword) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'ADMIN_PASSWORD не задан. В production задайте безопасный ADMIN_PASSWORD в окружении перед seed.'
        )
      }
      // dev: генерируем временный пароль и показываем один раз
      adminPassword = crypto.randomBytes(9).toString('base64url')
      generated = true
    }
    if (adminPassword.length < 8) {
      throw new Error('ADMIN_PASSWORD слишком короткий: минимум 8 символов.')
    }
    const passwordHash = await bcrypt.hash(adminPassword, 12)
    await prisma.user.create({
      data: {
        login: adminLogin,
        password_hash: passwordHash,
        role_id: headRole.id,
        is_active: true,
        must_change_password: true,
      },
    })
    if (generated) {
      console.log('────────────────────────────────────────────')
      console.log(`Создан администратор: login=${adminLogin}`)
      console.log(`Временный пароль (dev): ${adminPassword}`)
      console.log('Смените его при первом входе (must_change_password=true).')
      console.log('────────────────────────────────────────────')
    } else {
      console.log(`Создан администратор: login=${adminLogin} (пароль из ADMIN_PASSWORD).`)
    }
  }

  const treasuryCount = await prisma.treasury.count()
  if (treasuryCount === 0) {
    await prisma.treasury.create({
      data: { balance: 0 },
    })
  }

  console.log('Seed completed successfully.')
  console.log(`Roles ensured: Глава государства, Министр, Гражданин`)
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
