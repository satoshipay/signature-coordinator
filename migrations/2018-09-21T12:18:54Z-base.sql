CREATE TABLE signature_requests (
  id UUID PRIMARY KEY,
  hash VARCHAR(64) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP DEFAULT NULL,
  designated_coordinator BOOLEAN NOT NULL,
  request_uri TEXT NOT NULL,
  source_account_id VARCHAR(56) NOT NULL
);

CREATE INDEX ON signature_requests(completed_at);
CREATE INDEX ON signature_requests(source_account_id);

CREATE TABLE signers (
  signature_request UUID REFERENCES signature_requests(id) ON DELETE CASCADE NOT NULL,
  account_id VARCHAR(56) NOT NULL,
  has_signed BOOLEAN NOT NULL,
  PRIMARY KEY (signature_request, account_id)
);

CREATE INDEX ON signers(account_id);
CREATE INDEX ON signers(has_signed);
