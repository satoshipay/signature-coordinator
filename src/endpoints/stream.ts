import * as http from "http"
import { streamEvents, StreamContext } from "http-event-stream"

import { notifications, NotificationPayload } from "../notifications"
import { querySignatureRequests } from "./query"

function createServerSentEvent(eventName: string, id: string | number, data: any) {
  return {
    event: eventName,
    id: String(id),
    data: JSON.stringify(data)
  }
}

export async function streamSignatureRequests(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  subscribedAccountIDs: string[]
) {
  streamEvents(req, res, {
    async fetch(lastEventId: string) {
      const serializedSignatureRequests = await querySignatureRequests(subscribedAccountIDs, {
        cursor: lastEventId
      })

      return serializedSignatureRequests.map(serializedSignatureRequest => {
        return createServerSentEvent(
          "signature-request",
          serializedSignatureRequest.hash,
          serializedSignatureRequest
        )
      })
    },

    stream(context: StreamContext) {
      const onNewSignatureRequest = (payload: NotificationPayload) => {
        const { signatureRequest, signers } = payload

        if (signers.some(pubKey => subscribedAccountIDs.includes(pubKey))) {
          context.sendEvent(
            createServerSentEvent("transaction:added", signatureRequest.hash, signatureRequest)
          )
        }
      }
      const onUpdatedSignatureRequest = (payload: NotificationPayload) => {
        const { signatureRequest, signers } = payload

        if (signers.some(pubKey => subscribedAccountIDs.includes(pubKey))) {
          context.sendEvent(
            createServerSentEvent("transaction:updated", signatureRequest.hash, signatureRequest)
          )
        }
      }

      notifications.on("transaction:added", onNewSignatureRequest)
      notifications.on("transaction:updated", onUpdatedSignatureRequest)

      const unsubscribe = () => {
        notifications.removeListener("transaction:added", onNewSignatureRequest)
        notifications.removeListener("transaction:updated", onUpdatedSignatureRequest)
      }
      return unsubscribe
    }
  })
}
