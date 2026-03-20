import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { sendNotificationEmail } from "./email.ts"

export async function notify(
  supabase: SupabaseClient,
  {
    userId,
    message,
    link,
    subject,
  }: {
    userId: string
    message: string
    link?: string
    subject?: string
  },
): Promise<void> {
  await supabase.from("notifications").insert({
    user_id: userId,
    message,
    link: link ?? null,
  })

  const { data: profile } = await supabase
    .from("profiles")
    .select("email_notifications")
    .eq("id", userId)
    .single()

  if (profile?.email_notifications === false) return

  const {
    data: { user },
  } = await supabase.auth.admin.getUserById(userId)

  if (!user?.email) return

  await sendNotificationEmail({
    to: user.email,
    subject: subject ?? "BuildLog Notification",
    message,
    link,
  })
}
