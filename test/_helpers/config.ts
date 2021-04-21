import * as dotenv from "dotenv"
import * as path from "path"
import { Keypair } from "stellar-sdk"

function fail(message: string): never {
  throw Error(message)
}

dotenv.config({
  path: path.join(__dirname, "../../test.env")
})
dotenv.config({
  path: path.join(__dirname, "../../.env")
})

const testingConfig = {
  pubnetFundingKeypair: process.env.TESTING_PUBNET_SECRET_KEY
    ? Keypair.fromSecret(process.env.TESTING_PUBNET_SECRET_KEY)
    : fail("TESTING_PUBNET_SECRET_KEY not set")
}

export default testingConfig
