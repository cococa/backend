import { MembershipPlan, MembershipStatus } from '@prisma/client'
import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '../lib/prisma.js'

type EnsureDemoUserInput = {
  email: string
  name: string
}

export async function ensureDemoUser(input: EnsureDemoUserInput) {
  const user = await upsertUserWithMembership({
    authUserId: `demo:${input.email}`,
    email: input.email,
    name: input.name,
    emailVerifiedAt: new Date()
  })

  return user
}

type EnsureOAuthUserInput = {
  provider: 'google' | 'github'
  providerUserId: string
  email: string
  name: string
  avatar?: string | null
}

export async function ensureOAuthUser(input: EnsureOAuthUserInput) {
  const user = await upsertUserWithMembership({
    authUserId: `${input.provider}:${input.providerUserId}`,
    email: input.email,
    name: input.name,
    avatar: input.avatar ?? null,
    emailVerifiedAt: new Date()
  })

  return user
}

type RegisterLocalUserInput = {
  email: string
  name: string
  passwordHash: string
}

export async function registerLocalUser(input: RegisterLocalUserInput) {
  const existingByEmail = await prisma.user.findUnique({
    where: { email: input.email },
    include: { passwordCredential: true }
  })

  if (existingByEmail?.passwordCredential) {
    return {
      created: false as const,
      reason: 'EMAIL_ALREADY_REGISTERED' as const,
      user: existingByEmail
    }
  }

  if (existingByEmail && !existingByEmail.passwordCredential) {
    const updatedUser = await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        authUserId: `local:${input.email}`,
        name: input.name,
        emailVerifiedAt: null,
        passwordCredential: {
          create: {
            passwordHash: input.passwordHash
          }
        }
      },
      include: {
        passwordCredential: true
      }
    })

    await ensureFreeMembership(updatedUser.id)

    return {
      created: true as const,
      reason: null,
      user: updatedUser
    }
  }

  const user = await prisma.user.create({
    data: {
      authUserId: `local:${input.email}`,
      email: input.email,
      name: input.name,
      emailVerifiedAt: null,
      passwordCredential: {
        create: {
          passwordHash: input.passwordHash
        }
      }
    },
    include: {
      passwordCredential: true
    }
  })

  await ensureFreeMembership(user.id)

  return {
    created: true as const,
    reason: null,
    user
  }
}

export async function findLocalUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { passwordCredential: true }
  })
}

async function upsertUserWithMembership(input: {
  authUserId: string
  email: string
  name: string
  avatar?: string | null
  emailVerifiedAt?: Date | null
}) {
  const user = await prisma.user.upsert({
    where: {
      email: input.email
    },
    update: {
      authUserId: input.authUserId,
      name: input.name,
      avatar: input.avatar ?? undefined,
      emailVerifiedAt: input.emailVerifiedAt ?? undefined
    },
    create: {
      authUserId: input.authUserId,
      email: input.email,
      name: input.name,
      avatar: input.avatar ?? undefined,
      emailVerifiedAt: input.emailVerifiedAt ?? undefined
    }
  })

  await ensureFreeMembership(user.id)

  return user
}

async function ensureFreeMembership(userId: string) {
  await prisma.membership.upsert({
    where: {
      id: `membership:${userId}`
    },
    update: {
      plan: MembershipPlan.FREE,
      status: MembershipStatus.ACTIVE
    },
    create: {
      id: `membership:${userId}`,
      userId,
      plan: MembershipPlan.FREE,
      status: MembershipStatus.ACTIVE
    }
  })
}

function hashVerificationToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function issueEmailVerificationToken(userId: string) {
  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = hashVerificationToken(rawToken)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24)

  await prisma.emailVerificationToken.updateMany({
    where: {
      userId,
      usedAt: null
    },
    data: {
      usedAt: new Date()
    }
  })

  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt
    }
  })

  return {
    rawToken,
    expiresAt
  }
}

export async function consumeEmailVerificationToken(rawToken: string) {
  const tokenHash = hashVerificationToken(rawToken)
  const token = await prisma.emailVerificationToken.findUnique({
    where: {
      tokenHash
    },
    include: {
      user: true
    }
  })

  if (!token || token.usedAt || token.expiresAt.getTime() < Date.now()) {
    return null
  }

  const now = new Date()

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: token.id },
      data: { usedAt: now }
    }),
    prisma.user.update({
      where: { id: token.userId },
      data: { emailVerifiedAt: now }
    })
  ])

  return token.user
}
