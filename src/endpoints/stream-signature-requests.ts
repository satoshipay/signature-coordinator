import * as http from "http"
import { streamEvents, StreamContext } from "http-event-stream"

import {
  serializeSignatureRequest,
  SerializedSignatureRequest,
  SignatureRequest
} from "../models/signature-request"
import { serializeSigner, Signer } from "../models/signer"
import { notifications } from "../notifications"
import { querySignatureRequests } from "./query-signature-requests"

interface NotificationPayload {
  signatureRequest: SignatureRequest
  signers: Signer[]
}

function createServerSentEvent(eventName: string, timestamp: string | number, data: any) {
  return {
    event: eventName,
    id: String(new Date(timestamp).getTime()),
    data: JSON.stringify(data)
  }
}

export async function streamSignatureRequests(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  subscribedAccountIDs: string[],
  prepareSerializedSignatureRequest?: (serialized: SerializedSignatureRequest) => any
) {
  const prepareRequest = prepareSerializedSignatureRequest || (serialized => serialized)

  const prepareEvent = (
    eventName: string,
    signatureRequest: SignatureRequest,
    signers: Signer[]
  ) => {
    const serialized = serializeSignatureRequest(signatureRequest, signers.map(serializeSigner))
    return createServerSentEvent(eventName, signatureRequest.created_at, prepareRequest(serialized))
  }
  const someSignerMatches = (signers: Signer[], accountIDs: string[]) =>
    signers.some(someSigner => accountIDs.includes(someSigner.account_id))

  streamEvents(req, res, {
    async fetch(lastEventId: string) {
      const since = new Date(Number.parseInt(lastEventId, 10)).toISOString()
      const serializedSignatureRequests = await querySignatureRequests(subscribedAccountIDs, {
        cursor: since
      })

      return serializedSignatureRequests.map(serializedSignatureRequest => {
        return createServerSentEvent(
          "signature-request",
          serializedSignatureRequest.created_at,
          serializedSignatureRequest
        )
      })
    },

    stream(context: StreamContext) {
      const onNewSignatureRequest = (payload: NotificationPayload) => {
        if (someSignerMatches(payload.signers, subscribedAccountIDs)) {
          context.sendEvent(
            prepareEvent("signature-request", payload.signatureRequest, payload.signers)
          )
        }
      }
      const onUpdatedSignatureRequest = (payload: NotificationPayload) => {
        if (someSignerMatches(payload.signers, subscribedAccountIDs)) {
          context.sendEvent(
            prepareEvent("signature-request:updated", payload.signatureRequest, payload.signers)
          )
        }
      }
      const onSubmittedSignatureRequest = (payload: NotificationPayload) => {
        if (someSignerMatches(payload.signers, subscribedAccountIDs)) {
          context.sendEvent(
            prepareEvent("signature-request:submitted", payload.signatureRequest, payload.signers)
          )
        }
      }

      notifications.on("signature-request:new", onNewSignatureRequest)
      notifications.on("signature-request:updated", onUpdatedSignatureRequest)
      notifications.on("signature-request:submitted", onSubmittedSignatureRequest)

      const unsubscribe = () => {
        notifications.removeListener("signature-request:new", onNewSignatureRequest)
        notifications.removeListener("signature-request:updated", onUpdatedSignatureRequest)
        notifications.removeListener("signature-request:submitted", onSubmittedSignatureRequest)
      }
      return unsubscribe
    }
  })
}
