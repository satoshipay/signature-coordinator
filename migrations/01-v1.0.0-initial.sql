CREATE TYPE signature_request_status_type AS ENUM('pending', 'ready', 'submitted', 'failed');

CREATE TABLE signature_requests (
  id UUID PRIMARY KEY,
  hash VARCHAR(64) UNIQUE NOT NULL,
  req TEXT NOT NULL,
  source_req TEXT NOT NULL,
  status signature_request_status_type DEFAULT 'pending' NOT NULL,
  error JSONB DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX ON signature_requests(hash);
CREATE INDEX ON signature_requests(expires_at);


CREATE TABLE source_accounts (
  signature_request UUID REFERENCES signature_requests(id)
    ON DELETE CASCADE INITIALLY DEFERRED NOT NULL,
  account_id VARCHAR(56) NOT NULL,
  /* Only need to save one as we can select the right one (low, med, high) based on the tx */
  key_weight_threshold SMALLINT NOT NULL,
  PRIMARY KEY (signature_request, account_id)
);

CREATE INDEX ON source_accounts(signature_request);


CREATE TABLE signers (
  signature_request UUID REFERENCES signature_requests(id)
    ON DELETE CASCADE INITIALLY DEFERRED NOT NULL,
  source_account_id VARCHAR(56) NOT NULL,
  account_id VARCHAR(56) NOT NULL,
  key_weight SMALLINT NOT NULL,
  PRIMARY KEY (signature_request, account_id),
  FOREIGN KEY (signature_request, source_account_id) REFERENCES source_accounts (signature_request, account_id)
    INITIALLY DEFERRED
);

CREATE INDEX ON signers(account_id);


CREATE TABLE signatures (
  signature_request UUID REFERENCES signature_requests(id)
    ON DELETE CASCADE INITIALLY DEFERRED NOT NULL,
  signer_account_id VARCHAR(56) NOT NULL,
  signature TEXT NOT NULL,  /* FIXME: How long is the signature XDR really? */
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (signature_request, signer_account_id),
  FOREIGN KEY (signature_request, signer_account_id) REFERENCES signers (signature_request, account_id)
    INITIALLY DEFERRED
);

CREATE INDEX ON signatures(signature_request);
