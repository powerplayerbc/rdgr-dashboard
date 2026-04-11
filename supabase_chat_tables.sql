-- ══════════════════════════════════════════════════════
-- RDGR Command Chat Tables
-- Run this in the Supabase SQL Editor
-- ══════════════════════════════════════════════════════

-- 1. command_threads — Thread metadata
CREATE TABLE command_threads (
    thread_id       TEXT PRIMARY KEY,
    title           TEXT NOT NULL DEFAULT 'New Chat',
    created_by      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active',
    last_message_at TIMESTAMPTZ,
    message_count   INTEGER DEFAULT 0,
    preview_text    TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_command_threads_created_by ON command_threads(created_by);
CREATE INDEX idx_command_threads_status ON command_threads(status);
CREATE INDEX idx_command_threads_last_message ON command_threads(last_message_at DESC);

ALTER TABLE command_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_threads" ON command_threads FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_threads" ON command_threads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_threads" ON command_threads FOR UPDATE TO anon USING (true);


-- 2. command_messages — Individual messages
CREATE TABLE command_messages (
    message_id      TEXT PRIMARY KEY,
    thread_id       TEXT NOT NULL REFERENCES command_threads(thread_id),
    sender          TEXT NOT NULL,
    sender_type     TEXT NOT NULL DEFAULT 'human',
    content         TEXT NOT NULL,
    content_type    TEXT DEFAULT 'text',
    attachments     JSONB,
    metadata        JSONB,
    status          TEXT DEFAULT 'sent',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_command_messages_thread ON command_messages(thread_id, created_at ASC);
CREATE INDEX idx_command_messages_sender ON command_messages(sender);

ALTER TABLE command_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_messages" ON command_messages FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_messages" ON command_messages FOR INSERT TO anon WITH CHECK (true);


-- 3. command_thread_memory — Per-thread AI context memory
CREATE TABLE command_thread_memory (
    thread_id       TEXT PRIMARY KEY REFERENCES command_threads(thread_id),
    memory_summary  TEXT,
    key_facts       JSONB,
    context_window  JSONB,
    total_tokens    INTEGER DEFAULT 0,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE command_thread_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_memory" ON command_thread_memory FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_memory" ON command_thread_memory FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_memory" ON command_thread_memory FOR UPDATE TO anon USING (true);
