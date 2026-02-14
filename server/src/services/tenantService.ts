import { prisma } from "../lib/prisma.js"
import type { Membership, Organization, UserRole } from "@prisma/client"

export const SYSTEM_ORG_ID = "org_system"
export const DEFAULT_ORG_ID = "org_default"

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

export async function ensureSystemOrganization(): Promise<Organization> {
  return prisma.organization.upsert({
    where: { id: SYSTEM_ORG_ID },
    update: {
      name: "System",
      slug: "system"
    },
    create: {
      id: SYSTEM_ORG_ID,
      name: "System",
      slug: "system"
    }
  })
}

export async function ensureDefaultOrganization(): Promise<Organization> {
  return prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    update: {
      name: "Default Organization",
      slug: "default"
    },
    create: {
      id: DEFAULT_ORG_ID,
      name: "Default Organization",
      slug: "default"
    }
  })
}

export async function ensureTenantBootstrap(): Promise<void> {
  await ensureSystemOrganization()
  await ensureDefaultOrganization()
}

export async function ensureOrganization(input: { slug: string; name: string }): Promise<Organization> {
  const slug = normalizeSlug(input.slug)
  if (!slug) {
    throw new Error("Organization slug is required")
  }

  return prisma.organization.upsert({
    where: { slug },
    update: { name: input.name },
    create: {
      slug,
      name: input.name
    }
  })
}

export async function ensureMembership(input: { orgId: string; userId: string; role: UserRole }): Promise<Membership> {
  return prisma.membership.upsert({
    where: {
      orgId_userId: {
        orgId: input.orgId,
        userId: input.userId
      }
    },
    update: {
      role: input.role
    },
    create: {
      orgId: input.orgId,
      userId: input.userId,
      role: input.role
    }
  })
}

export async function resolveLoginMembership(input: {
  userId: string
  requestedOrgId?: string
}): Promise<(Membership & { organization: Organization }) | null> {
  if (input.requestedOrgId) {
    return prisma.membership.findFirst({
      where: {
        userId: input.userId,
        orgId: input.requestedOrgId
      },
      include: { organization: true }
    })
  }

  const memberships = await prisma.membership.findMany({
    where: {
      userId: input.userId,
      orgId: {
        not: SYSTEM_ORG_ID
      }
    },
    orderBy: { createdAt: "asc" },
    include: { organization: true },
    take: 2
  })

  if (memberships.length !== 1) return null
  return memberships[0]
}

export function normalizeOrganizationInput(input: { orgName?: string | undefined; orgSlug?: string | undefined }): {
  slug: string
  name: string
} {
  const name = (input.orgName || "Default Organization").trim().slice(0, 120)
  const slugSource = input.orgSlug?.trim() || (input.orgName ? name : "default")
  const slug = normalizeSlug(slugSource) || "default"
  return { slug, name }
}
