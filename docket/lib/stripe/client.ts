import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    'STRIPE_SECRET_KEY is not set. Add it to .env.local (server-only, never expose to browser).'
  )
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
