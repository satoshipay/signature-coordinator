import { EventStream } from "http-event-stream"

import { SignatureRequest } from "../models/signature-request"
import { Signer } from "../models/signer"
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
      signatureRequest: {
        id: signatureRequest.id,
        request_uri: signatureRequest.request_uri,
        source_account_id: signatureRequest.source_account_id
      },
      signers: signers.map(signer => ({
        account_id: signer.account_id,
        has_signed: signer.has_signed
      }))
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
