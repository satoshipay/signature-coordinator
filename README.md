# Multi-Signature Coordination Service

Implementation of a transaction signature relay service for the Stellar network.

Wallets and other Stellar clients can use it to coordinate signing transactions before they are submitted to the network. All data is stored off-ledger in a postgres database.

## Configuration

Copy test.env to .env and modify as needed.

## Run tests locally

```sh
npm run dev:db &
npm run dev:db:seed (or) npm run build && npm run migrate
npm test
```

***Note:***
The account associtated to the env variable `TESTING_PUBNET_SECRET_KEY` should have a spendable balance of at least 5 XLM, otherwise the test for pubnet submission fails.
