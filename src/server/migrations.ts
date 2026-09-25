// Append-only, versioned Postgres schema migrations. Never edit a migration that has
// shipped — add a new one. Each runs inside its own transaction (see db.ts), so a failure
// leaves the database exactly as it was.
//
// Timestamps are BIGINT milliseconds since the epoch; flags are 0/1 SMALLINTs.

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

const TABLES = ["users", "sessions", "otp_challenges", "rate_limits", "datasets", "audit_log", "app_meta", "schema_migrations"];

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "auth_and_dataset",
    sql: `
      CREATE TABLE users (
        id                    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        username              TEXT     NOT NULL,
        display_name          TEXT     NOT NULL,
        role                  TEXT     NOT NULL CHECK (role IN ('CREATOR_ADMIN','ADMINISTRATOR','HOD','FACULTY')),
        email                 TEXT,
        email_verified        SMALLINT NOT NULL DEFAULT 0,
        password_hash         TEXT     NOT NULL,
        must_change_password  SMALLINT NOT NULL DEFAULT 1,
        is_active             SMALLINT NOT NULL DEFAULT 1,
        created_by            INTEGER  REFERENCES users(id),
        created_at            BIGINT   NOT NULL,
        updated_at            BIGINT   NOT NULL,
        password_changed_at   BIGINT
      );
      -- Usernames and emails are unique regardless of letter case.
      CREATE UNIQUE INDEX users_username_ci ON users (lower(username));
      CREATE UNIQUE INDEX users_email_ci ON users (lower(email));
      -- Exactly one Creator Admin can ever exist.
      CREATE UNIQUE INDEX users_single_creator ON users (role) WHERE role = 'CREATOR_ADMIN';

      CREATE TABLE sessions (
        id            TEXT     PRIMARY KEY,          -- SHA-256 of the cookie token, never the token itself
        user_id       INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        stage         TEXT     NOT NULL CHECK (stage IN ('pending','active')),
        created_at    BIGINT   NOT NULL,
        expires_at    BIGINT   NOT NULL,
        last_seen_at  BIGINT   NOT NULL,
        ip            TEXT,
        user_agent    TEXT
      );
      CREATE INDEX sessions_user ON sessions (user_id);
      CREATE INDEX sessions_expires ON sessions (expires_at);

      CREATE TABLE otp_challenges (
        id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id       INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purpose       TEXT     NOT NULL CHECK (purpose IN ('first_login','change_password','reset_password')),
        email         TEXT     NOT NULL,
        code_hash     TEXT     NOT NULL,
        attempts      INTEGER  NOT NULL DEFAULT 0,
        created_at    BIGINT   NOT NULL,
        expires_at    BIGINT   NOT NULL,
        verified_at   BIGINT,
        consumed_at   BIGINT,
        token_hash    TEXT                            -- set on verification; authorises the password step
      );
      CREATE INDEX otp_user_purpose ON otp_challenges (user_id, purpose);
      CREATE INDEX otp_token ON otp_challenges (token_hash) WHERE token_hash IS NOT NULL;

      CREATE TABLE rate_limits (
        key           TEXT     PRIMARY KEY,
        window_start  BIGINT   NOT NULL,
        count         INTEGER  NOT NULL
      );

      -- The shared academic dataset. A single row: InsightChart analyses one dataset at a time.
      CREATE TABLE datasets (
        id              INTEGER  PRIMARY KEY CHECK (id = 1),
        source_json     TEXT     NOT NULL,
        config_json     TEXT     NOT NULL,
        source_version  INTEGER  NOT NULL,
        updated_by      INTEGER  REFERENCES users(id) ON DELETE SET NULL,
        updated_at      BIGINT   NOT NULL
      );

      CREATE TABLE audit_log (
        id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id     INTEGER  REFERENCES users(id) ON DELETE SET NULL,
        action      TEXT     NOT NULL,
        detail      TEXT,
        created_at  BIGINT   NOT NULL
      );
      CREATE INDEX audit_created ON audit_log (created_at);

      CREATE TABLE app_meta (
        key    TEXT PRIMARY KEY,
        value  TEXT NOT NULL
      );

      -- Supabase publishes every table in "public" through its Data API to anyone holding
      -- the project's public anon key. InsightChart never uses that API — the server
      -- connects directly as the database owner — so switch it off for these tables:
      -- row level security with no policies denies every API request, and the API roles
      -- lose their grants. (On plain Postgres the roles don't exist and this is skipped.)
      ${TABLES.map((t) => `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`).join("\n      ")}
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          EXECUTE 'REVOKE ALL ON ${TABLES.join(", ")} FROM anon, authenticated';
        END IF;
      END $$;
    `,
  },
];
