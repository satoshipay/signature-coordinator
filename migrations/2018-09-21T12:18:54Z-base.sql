CREATE TABLE signature_requests (
  id UUID PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP DEFAULT NULL,
  designated_coordinator BOOLEAN NOT NULL,
  request_url VARCHAR (4095) NOT NULL,
  source_account_id VARCHAR(56)
);

CREATE INDEX ON signature_requests(completed_at);
CREATE INDEX ON signature_requests(source_account_id);

CREATE TABLE cosigners (
  signature_request UUID REFERENCES signature_requests(id) ON DELETE CASCADE NOT NULL,
  cosigner_account_id VARCHAR(56) NOT NULL,
  has_signed BOOLEAN NOT NULL,
  PRIMARY KEY (signature_request, cosigner_account_id)
);

CREATE INDEX ON cosigners(cosigner_account_id);
CREATE INDEX ON cosigners(has_signed);
