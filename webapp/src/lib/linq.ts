/**
 * Linq helpers — re-exports around {@link LinqService}.
 * Prefer `import { LinqService, getLinqService, readLinqEnv } from "@/lib/linq-service"` in new code.
 */

import {
  LinqService,
  getLinqService,
  LinqConfigError,
  readLinqEnv,
  toE164,
  type CreateChatBody,
} from "@/lib/linq-service";

export { LinqService, getLinqService, LinqConfigError, readLinqEnv, toE164, type CreateChatBody };

/** Non-throwing env snapshot (token may be undefined). */
export function getLinqConfig() {
  return readLinqEnv();
}

export async function linqListPhoneNumbers() {
  return getLinqService().listPhoneNumbers();
}

export async function linqCreateChat(body: CreateChatBody) {
  return getLinqService().createChat(body);
}
