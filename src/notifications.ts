import TypedEmitter from "typed-emitter"

import { SignatureRequest } from "./models/signature-request"
import { Signer } from "./models/signer"
import { notificationsSubscription } from "./database"

interface SignatureRequestWithSigners {
  signatureRequest: SignatureRequest
  signers: Signer[]
}

interface NotificationEvents {
  "signature-request:new": (payload: SignatureRequestWithSigners) => void
  "signature-request:updated": (payload: SignatureRequestWithSigners) => void
  "signature-request:submitted": (payload: SignatureRequestWithSigners) => void
}

export const notifications = (notificationsSubscription.notifications as any) as TypedEmitter<
  NotificationEvents
>

export function subscribeToChannels() {
  notificationsSubscription.listenTo("signature-request:new")
  notificationsSubscription.listenTo("signature-request:updated")
  notificationsSubscription.listenTo("signature-request:submitted")
}

export async function notifyNewSignatureRequest(payload: SignatureRequestWithSigners) {
  return notificationsSubscription.notify("signature-request:new", payload)
}

export async function notifySignatureRequestUpdated(payload: SignatureRequestWithSigners) {
  return notificationsSubscription.notify("signature-request:updated", payload)
}

export async function notifySignatureRequestSubmitted(payload: SignatureRequestWithSigners) {
  return notificationsSubscription.notify("signature-request:submitted", payload)
}
