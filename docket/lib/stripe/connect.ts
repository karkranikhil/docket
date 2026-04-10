import { stripe } from './client'
import { createClient } from '@/lib/supabase/server'
import type { Tradie, Invoice } from '@/types/database'

export async function createConnectAccount(tradie: {
  id: string
  email: string
  business_name: string
}): Promise<string> {
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'AU',
    email: tradie.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual',
    business_profile: {
      mcc: '1711',
      url: 'https://docket.com.au',
    },
  })

  const supabase = await createClient()
  await supabase
    .from('tradies')
    .update({ stripe_account_id: account.id })
    .eq('id', tradie.id)

  return account.id
}

export async function createOnboardingLink(accountId: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_URL ?? 'https://docket.com.au'

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/settings/payments/refresh`,
    return_url: `${baseUrl}/settings/payments/done`,
    type: 'account_onboarding',
  })

  return link.url
}

export async function createPaymentLink(
  invoice: Invoice,
  tradie: Tradie
): Promise<string | null> {
  if (!tradie.stripe_charges_enabled || !tradie.stripe_payouts_enabled) {
    return null
  }

  if (!tradie.stripe_account_id) {
    return null
  }

  const totalCents = Math.round(Number(invoice.total) * 100)
  const feeAmount = Math.round(totalCents * 0.005) // 0.5% platform fee

  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price_data: {
          currency: 'aud',
          unit_amount: totalCents,
          product_data: {
            name: `Invoice ${invoice.invoice_number}`,
            description: tradie.business_name,
          },
        },
        quantity: 1,
      },
    ],
    application_fee_amount: feeAmount,
    transfer_data: {
      destination: tradie.stripe_account_id,
    },
    metadata: {
      invoice_id: invoice.id,
      tradie_id: tradie.id,
    },
  })

  const supabase = await createClient()
  await supabase
    .from('invoices')
    .update({
      stripe_payment_link_id: paymentLink.id,
      stripe_payment_link_url: paymentLink.url,
    })
    .eq('id', invoice.id)

  return paymentLink.url
}

export async function getAccountStatus(
  accountId: string
): Promise<{ charges_enabled: boolean; payouts_enabled: boolean }> {
  const account = await stripe.accounts.retrieve(accountId)
  return {
    charges_enabled: account.charges_enabled ?? false,
    payouts_enabled: account.payouts_enabled ?? false,
  }
}
