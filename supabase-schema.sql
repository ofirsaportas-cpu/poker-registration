-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- Events
CREATE TABLE IF NOT EXISTS events (
  id          text PRIMARY KEY,
  type        text NOT NULL,
  date        text NOT NULL,
  time        text NOT NULL,
  location    text DEFAULT '',
  max_seats   int  NOT NULL DEFAULT 9
);

-- Registrations (per-event player entries)
CREATE TABLE IF NOT EXISTS registrations (
  id          text    PRIMARY KEY,
  event_id    text    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        text    NOT NULL,
  phone       text    DEFAULT '',
  status      text    NOT NULL DEFAULT 'ממתין לאישור',
  is_regular  boolean NOT NULL DEFAULT false,
  joined_at   bigint  NOT NULL DEFAULT 0
);

-- Global players list
CREATE TABLE IF NOT EXISTS players (
  id         text    PRIMARY KEY,
  name       text    NOT NULL,
  phone      text    DEFAULT '',
  is_regular boolean NOT NULL DEFAULT false
);

-- App settings (single row, id = 1)
CREATE TABLE IF NOT EXISTS settings (
  id                int  PRIMARY KEY DEFAULT 1,
  group_name        text NOT NULL DEFAULT 'חבורת הפוקר',
  recurring_day     int  NOT NULL DEFAULT 3,
  default_time      text NOT NULL DEFAULT '21:00',
  default_location  text DEFAULT '',
  default_max_seats int  NOT NULL DEFAULT 9,
  admin_password    text NOT NULL DEFAULT '1001'
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── Row Level Security ───────────────────────────────────────────────────────
-- The app uses only the anon key, so we allow all operations publicly.

ALTER TABLE events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE players      ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON events        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON registrations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON players       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON settings      FOR ALL USING (true) WITH CHECK (true);

-- ── Realtime ────────────────────────────────────────────────────────────────
-- Enable realtime publication for all tables so the app syncs across devices.

ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE registrations;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
