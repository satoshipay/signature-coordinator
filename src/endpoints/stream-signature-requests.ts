import { EventStream } from "http-event-stream"

import { serializeSignatureRequest, SignatureRequest } from "../models/signature-request"
import { serializeSigner, Signer } from "../models/signer"
import { notifications } from "../notifications"

function sendEvent(
  eventStream: EventStream,
  eventName: string,
  signatureRequest: SignatureRequest,
  signers: Signer[]
) {
  eventStream.sendMessage({
    event: eventName,
    id: signatureRequest.created_at,
    data: JSON.stringify({
      signatureRequest: serializeSignatureRequest(signatureRequest),
      signers: signers.map(signer => serializeSigner(signer))
    })
  })
}

export async function streamSignatureRequests(
  eventStream: EventStream,
  subscribedAccountIDs: string[],
  lastEventID?: string
) {
  if (lastEventID) {
    // FIXME: Query signature requests since `lastEventID` time
  }

  notifications.on("signature-request:new", ({ signatureRequest, signers }) => {
    const signer = signers.find(someSigner => subscribedAccountIDs.includes(someSigner.account_id))
    if (signer) {
      sendEvent(eventStream, "signature-request", signatureRequest, signers)
    }
  })
  notifications.on("signature-request:updated", ({ signatureRequest, signers }) => {
    const signer = signers.find(someSigner => subscribedAccountIDs.includes(someSigner.account_id))
    if (signer) {
      sendEvent(eventStream, "signature-request:updated", signatureRequest, signers)
    }
  })
  notifications.on("signature-request:submitted", ({ signatureRequest, signers }) => {
    const signer = signers.find(someSigner => subscribedAccountIDs.includes(someSigner.account_id))
    if (signer) {
      sendEvent(eventStream, "signature-request:submitted", signatureRequest, signers)
    }
  })
}
