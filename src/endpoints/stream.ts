import * as http from "http"
import { streamEvents, StreamContext } from "http-event-stream"

import { SerializedSignatureRequest } from "../models/signature-request"
import { notifications, NotificationPayload } from "../notifications"
import { querySignatureRequests } from "./query"

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
        const { signatureRequest, signers } = payload

        if (signers.some(pubKey => subscribedAccountIDs.includes(pubKey))) {
          context.sendEvent(
            createServerSentEvent(
              "request:added",
              signatureRequest.created_at,
              prepareRequest(signatureRequest)
            )
          )
        }
      }
      const onUpdatedSignatureRequest = (payload: NotificationPayload) => {
        const { signatureRequest, signers } = payload

        if (signers.some(pubKey => subscribedAccountIDs.includes(pubKey))) {
          context.sendEvent(
            createServerSentEvent(
              "request:updated",
              signatureRequest.created_at,
              prepareRequest(signatureRequest)
            )
          )
        }
      }

      notifications.on("signature-request:new", onNewSignatureRequest)
      notifications.on("signature-request:updated", onUpdatedSignatureRequest)

      const unsubscribe = () => {
        notifications.removeListener("signature-request:new", onNewSignatureRequest)
        notifications.removeListener("signature-request:updated", onUpdatedSignatureRequest)
      }
      return unsubscribe
    }
  })
}
