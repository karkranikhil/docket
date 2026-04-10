import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createOnboardingLink } from '@/lib/stripe/connect'

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { data: tradie } = await supabase
    .from('tradies')
    .select('stripe_account_id')
    .eq('user_id', user.id)
    .single()

  if (!tradie?.stripe_account_id) {
    redirect('/settings/payments')
  }

  const url = await createOnboardingLink(tradie.stripe_account_id)
  redirect(url)
}
