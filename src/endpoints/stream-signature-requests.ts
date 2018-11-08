import { EventStream } from "http-event-stream"

import { serializeSignatureRequest, SerializedSignatureRequest } from "../models/signature-request"
import { serializeSigner } from "../models/signer"
import { notifications } from "../notifications"

function sendEvent(
  eventStream: EventStream,
  eventName: string,
  timestamp: string | number,
  data: any
) {
  eventStream.sendMessage({
    event: eventName,
    id: String(new Date(timestamp).getTime()),
    data: JSON.stringify(data)
  })
}

export async function streamSignatureRequests(
  eventStream: EventStream,
  subscribedAccountIDs: string[],
  lastEventID?: string,
  prepareSerializedSignatureRequest?: (serialized: SerializedSignatureRequest) => any
) {
  const prepareRequest = prepareSerializedSignatureRequest || (serialized => serialized)

  if (lastEventID) {
    // FIXME: Query signature requests since `lastEventID` time
  }

  notifications.on("signature-request:new", ({ signatureRequest, signers }) => {
    const signer = signers.find(someSigner => subscribedAccountIDs.includes(someSigner.account_id))
    if (signer) {
      const data = prepareRequest(
        serializeSignatureRequest(signatureRequest, signers.map(serializeSigner))
      )
      sendEvent(eventStream, "signature-request", signatureRequest.created_at, data)
    }
  })
  notifications.on("signature-request:updated", ({ signatureRequest, signers }) => {
    const signer = signers.find(someSigner => subscribedAccountIDs.includes(someSigner.account_id))
    if (signer) {
      const data = prepareRequest(
        serializeSignatureRequest(signatureRequest, signers.map(serializeSigner))
      )
      sendEvent(eventStream, "signature-request:updated", signatureRequest.created_at, data)
    }
  })
  notifications.on("signature-request:submitted", ({ signatureRequest, signers }) => {
    const signer = signers.find(someSigner => subscribedAccountIDs.includes(someSigner.account_id))
    if (signer) {
      const data = prepareRequest(
        serializeSignatureRequest(signatureRequest, signers.map(serializeSigner))
      )
      sendEvent(eventStream, "signature-request:submitted", signatureRequest.created_at, data)
    }
  })
}
