/**
 * One-time migration: encrypt plaintext tokens in platform_connections.
 * Run with: bun scripts/encrypt-existing-tokens.ts
 */
import { config } from 'dotenv'

config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { encrypt } from '../lib/crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function isEncrypted(value: string): boolean {
  const parts = value.split(':')
  return parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/.test(p))
}

async function main() {
  const { data: rows, error } = await supabase
    .from('platform_connections')
    .select('id, access_token, refresh_token')

  if (error) {
    console.error('Failed to fetch rows:', error.message)
    process.exit(1)
  }

  if (!rows || rows.length === 0) {
    console.log('No platform_connections rows found. Nothing to do.')
    return
  }

  let updated = 0
  let skipped = 0

  for (const row of rows) {
    const updates: Record<string, string> = {}

    if (row.access_token && !isEncrypted(row.access_token)) {
      updates.access_token = encrypt(row.access_token)
    }
    if (row.refresh_token && !isEncrypted(row.refresh_token)) {
      updates.refresh_token = encrypt(row.refresh_token)
    }

    if (Object.keys(updates).length === 0) {
      skipped++
      continue
    }

    const { error: updateError } = await supabase
      .from('platform_connections')
      .update(updates)
      .eq('id', row.id)

    if (updateError) {
      console.error(`Failed to update row ${row.id}:`, updateError.message)
    } else {
      updated++
      console.log(`Encrypted tokens for row ${row.id}`)
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped (already encrypted): ${skipped}`)
}

main()
