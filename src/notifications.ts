import TypedEmitter from "typed-emitter"

import { notificationsSubscription } from "./database"
import { SerializedSignatureRequest } from "./models/signature-request"

export interface NotificationPayload {
  signatureRequest: SerializedSignatureRequest
  signers: string[]
}

interface NotificationEvents {
  "transaction:added": (notification: NotificationPayload) => void
  "transaction:updated": (notification: NotificationPayload) => void
}

export const notifications = (notificationsSubscription.notifications as any) as TypedEmitter<
  NotificationEvents
>

export function subscribeToChannels() {
  notificationsSubscription.listenTo("transaction:added")
  notificationsSubscription.listenTo("transaction:updated")
}

export async function notifyNewSignatureRequest(
  signatureRequest: SerializedSignatureRequest,
  signers: string[]
) {
  return notificationsSubscription.notify("transaction:added", {
    signatureRequest,
    signers
  })
}

export async function notifySignatureRequestUpdate(
  signatureRequest: SerializedSignatureRequest,
  signers: string[]
) {
  return notificationsSubscription.notify("transaction:updated", {
    signatureRequest,
    signers
  })
}
