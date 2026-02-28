import { MembershipPlan, MembershipStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

type EnsureDemoUserInput = {
  email: string
  name: string
}

export async function ensureDemoUser(input: EnsureDemoUserInput) {
  const authUserId = `demo:${input.email}`

  const user = await prisma.user.upsert({
    where: {
      email: input.email
    },
    update: {
      authUserId,
      name: input.name
    },
    create: {
      authUserId,
      email: input.email,
      name: input.name
    }
  })

  await prisma.membership.upsert({
    where: {
      id: `membership:${user.id}`
    },
    update: {
      plan: MembershipPlan.FREE,
      status: MembershipStatus.ACTIVE
    },
    create: {
      id: `membership:${user.id}`,
      userId: user.id,
      plan: MembershipPlan.FREE,
      status: MembershipStatus.ACTIVE
    }
  })

  return user
}
