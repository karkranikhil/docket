import { stripe } from './client'
import type { Tradie } from '@/types/database'

const PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID ?? '',
  pro: process.env.STRIPE_PRO_PRICE_ID ?? '',
}

export async function createCheckoutSession(
  tradie: Tradie,
  tier: 'starter' | 'pro'
): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_URL ?? 'https://docket.com.au'
  const priceId = PRICE_IDS[tier]

  if (!priceId) {
    throw new Error(`No Stripe price ID configured for tier: ${tier}`)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: tradie.stripe_customer_id ?? undefined,
    customer_email: tradie.stripe_customer_id ? undefined : tradie.email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/billing?success=true`,
    cancel_url: `${baseUrl}/billing?canceled=true`,
    metadata: {
      tradie_id: tradie.id,
    },
    subscription_data: {
      metadata: {
        tradie_id: tradie.id,
      },
    },
  })

  if (!session.url) {
    throw new Error('Stripe did not return a checkout session URL')
  }

  return session.url
}

export async function createCustomerPortalSession(
  customerId: string
): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_URL ?? 'https://docket.com.au'

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl}/billing`,
  })

  return session.url
}
