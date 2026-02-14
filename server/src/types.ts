import type { Request } from "express"
import type { UserRole } from "@prisma/client"

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  orgId: string
}

export interface BaseRequest extends Request {
  requestId?: string
}

export interface AuthenticatedRequest extends BaseRequest {
  user: AuthUser
}
