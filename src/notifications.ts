import TypedEmitter from "typed-emitter"

import { notificationsSubscription } from "./database"
import { SerializedSignatureRequest } from "./models/signature-request"

export interface NotificationPayload {
  signatureRequest: SerializedSignatureRequest
  signers: string[]
}

interface NotificationEvents {
  "signature-request:new": (notification: NotificationPayload) => void
  "signature-request:updated": (notification: NotificationPayload) => void
}

export const notifications = (notificationsSubscription.notifications as any) as TypedEmitter<
  NotificationEvents
>

export function subscribeToChannels() {
  notificationsSubscription.listenTo("signature-request:new")
  notificationsSubscription.listenTo("signature-request:updated")
}

export async function notifyNewSignatureRequest(
  signatureRequest: SerializedSignatureRequest,
  signers: string[]
) {
  return notificationsSubscription.notify("signature-request:new", {
    signatureRequest,
    signers
  })
}

export async function notifySignatureRequestUpdate(
  signatureRequest: SerializedSignatureRequest,
  signers: string[]
) {
  return notificationsSubscription.notify("signature-request:updated", {
    signatureRequest,
    signers
  })
}
