import { HistoryItemV1, Role } from '@/types/chat'

export function pickByRoles<R extends string, Item extends { role: string }>(arr: Item[], roles: R[]): (Item & { role: R })[] {
  return arr.filter((item) => roles.includes(item.role as R)) as (Item & { role: R })[]
}

export function isRoleMessage(item: HistoryItemV1, role: Role): item is HistoryItemV1 & { role: Role } {
  return item.role === role
}
