import test from "ava"
import bodyParser from "body-parser"
import * as http from "http"
import { URL } from "url"

interface Handler {
  path: string
  handler: http.RequestListener
}

const port = 1234
const baseUrl = `http://localhost:${port}`

let handlers: Handler[] = []
let server: http.Server

test.before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url!, baseUrl)
    const matchingHandler = handlers.find(handler => handler.path === url.pathname)

    if (matchingHandler) {
      matchingHandler.handler(req, res)
    } else {
      res.statusCode = 404
      res.write("Not found", "utf-8")
      res.end()
    }
  })

  await new Promise(resolve => {
    server.listen(port, resolve)
  })
})

test.after(() => {
  server.close()
})

function createEndpoint(pathname: string, handler: Handler["handler"]) {
  if (handlers.some(h => h.path === pathname)) {
    throw Error(`Attempt to double-register testing endpoint: ${pathname}`)
  }

  handlers.push({
    path: pathname,
    handler
  })
}

export function createCallbackEndpoint(
  pathname: string,
  handler: (xdr: string, res: http.ServerResponse) => any
) {
  const parser = bodyParser.urlencoded()
  const xdrs: string[] = []

  createEndpoint(pathname, (req, res) => {
    parser(req, res, () => {
      const { xdr } = (req as any).body
      xdrs.push(xdr)

      try {
        handler(xdr, res)
      } catch (error) {
        console.error(error)
        res.statusCode = 500
        res.write("Internal Server Error", "utf-8")
        res.end()
      }
    })
  })

  return {
    captured() {
      return xdrs
    },
    url: String(new URL(pathname, baseUrl))
  }
}
