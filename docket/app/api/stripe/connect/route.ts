import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createConnectAccount, createOnboardingLink, getAccountStatus } from '@/lib/stripe/connect'

export async function POST() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: tradie, error: tradieError } = await supabase
    .from('tradies')
    .select('id, email, business_name, stripe_account_id')
    .eq('user_id', user.id)
    .single()

  if (tradieError || !tradie) {
    return NextResponse.json({ error: 'Tradie not found' }, { status: 404 })
  }

  let accountId = tradie.stripe_account_id

  if (!accountId) {
    accountId = await createConnectAccount({
      id: tradie.id,
      email: tradie.email,
      business_name: tradie.business_name,
    })
  }

  const url = await createOnboardingLink(accountId)

  return NextResponse.json({ url })
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: tradie, error: tradieError } = await supabase
    .from('tradies')
    .select(
      'stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_onboarding_complete'
    )
    .eq('user_id', user.id)
    .single()

  if (tradieError || !tradie) {
    return NextResponse.json({ error: 'Tradie not found' }, { status: 404 })
  }

  if (tradie.stripe_account_id && !tradie.stripe_onboarding_complete) {
    const live = await getAccountStatus(tradie.stripe_account_id)
    return NextResponse.json({
      stripe_account_id: tradie.stripe_account_id,
      charges_enabled: live.charges_enabled,
      payouts_enabled: live.payouts_enabled,
      onboarding_complete: live.charges_enabled && live.payouts_enabled,
    })
  }

  return NextResponse.json({
    stripe_account_id: tradie.stripe_account_id,
    charges_enabled: tradie.stripe_charges_enabled,
    payouts_enabled: tradie.stripe_payouts_enabled,
    onboarding_complete: tradie.stripe_onboarding_complete,
  })
}
