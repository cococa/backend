import { MembershipPlan, MembershipStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

type EnsureDemoUserInput = {
  email: string
  name: string
}

export async function ensureDemoUser(input: EnsureDemoUserInput) {
  const user = await upsertUserWithMembership({
    authUserId: `demo:${input.email}`,
    email: input.email,
    name: input.name
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
    avatar: input.avatar ?? null
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
}) {
  const user = await prisma.user.upsert({
    where: {
      email: input.email
    },
    update: {
      authUserId: input.authUserId,
      name: input.name,
      avatar: input.avatar ?? undefined
    },
    create: {
      authUserId: input.authUserId,
      email: input.email,
      name: input.name,
      avatar: input.avatar ?? undefined
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
