'use strict';

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load env vars: prefer .env.local, then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const csvPath = path.join(process.cwd(), 'supabase/seed/words_oxford3000.csv');

function parseTags(raw) {
  if (!raw || raw === '{}') return [];
  if (raw.startsWith('{') && raw.endsWith('}')) {
    return raw
      .slice(1, -1)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [raw];
}

function parseExtra(raw) {
  if (!raw || raw === '{}') return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function main() {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parse(content, { columns: true, skip_empty_lines: true });

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).map((r) => ({
      text_en: r.text_en,
      level: r.level || null,
      example_en: r.example_en || null,
      example_ru: r.example_ru || null,
      tags: parseTags(r.tags),
      extra: parseExtra(r.extra),
    }));

    const { error } = await supabase.from('words').upsert(chunk, { onConflict: 'text_en' });
    if (error) {
      throw error;
    }
    console.log(`Upserted ${Math.min(i + chunk.length, rows.length)} / ${rows.length}`);
  }

  console.log('Done seeding words.');
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});

