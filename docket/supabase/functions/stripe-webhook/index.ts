import Stripe from 'npm:stripe'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const BOT_URL = Deno.env.get('BOT_URL') ?? 'http://localhost:8000'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Webhook signature verification failed:', message)
    return new Response(`Webhook Error: ${message}`, { status: 400 })
  }

  // Return 200 immediately, process async
  const response = new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  // Process event in background (Edge Functions support waitUntil-style via returning response first)
  try {
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event)
        break
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event)
        break
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event)
        break
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error(`Error processing ${event.type}:`, err)
  }

  return response
})

async function handleAccountUpdated(event: Stripe.Event) {
  const account = event.data.object as Stripe.Account
  const accountId = account.id
  const chargesEnabled = account.charges_enabled ?? false
  const payoutsEnabled = account.payouts_enabled ?? false

  const { data: tradie } = await supabase
    .from('tradies')
    .select('id, stripe_charges_enabled, whatsapp_number')
    .eq('stripe_account_id', accountId)
    .single()

  if (!tradie) {
    console.error(`No tradie found for stripe_account_id: ${accountId}`)
    return
  }

  const wasChargesEnabled = tradie.stripe_charges_enabled
  const onboardingComplete = chargesEnabled && payoutsEnabled

  await supabase
    .from('tradies')
    .update({
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
      stripe_onboarding_complete: onboardingComplete,
    })
    .eq('id', tradie.id)

  if (chargesEnabled && !wasChargesEnabled) {
    await notifyBot(tradie.whatsapp_number, 'Payments activated! Your clients can now pay invoices online. 💳')
  }
}

async function handlePaymentSucceeded(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  const invoiceId = paymentIntent.metadata?.invoice_id
  const tradieId = paymentIntent.metadata?.tradie_id

  if (!invoiceId) {
    console.log('payment_intent.succeeded without invoice_id in metadata, skipping')
    return
  }

  // Idempotent: only update if not already paid
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, status, invoice_number, total')
    .eq('id', invoiceId)
    .single()

  if (!invoice) {
    console.error(`Invoice not found: ${invoiceId}`)
    return
  }

  if (invoice.status === 'paid') {
    console.log(`Invoice ${invoiceId} already marked paid, skipping duplicate webhook`)
    return
  }

  await supabase
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntent.id,
    })
    .eq('id', invoiceId)

  if (tradieId) {
    try {
      await fetch(`${BOT_URL}/internal/notify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradie_id: tradieId,
          invoice_id: invoiceId,
          amount: Number(invoice.total),
        }),
      })
    } catch (err) {
      console.error('Failed to notify bot of payment:', err)
    }
  }
}

async function handleSubscriptionCreated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const tradieId = subscription.metadata?.tradie_id
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id

  if (!tradieId) {
    console.error('subscription.created without tradie_id in metadata')
    return
  }

  const tier = resolveTier(subscription)

  await supabase
    .from('tradies')
    .update({
      subscription_status: 'active',
      subscription_tier: tier,
      subscribed_at: new Date().toISOString(),
      stripe_customer_id: customerId,
    })
    .eq('id', tradieId)
}

async function handleSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const tradieId = subscription.metadata?.tradie_id

  if (!tradieId) {
    console.error('subscription.deleted without tradie_id in metadata')
    return
  }

  const { data: tradie } = await supabase
    .from('tradies')
    .select('whatsapp_number')
    .eq('id', tradieId)
    .single()

  await supabase
    .from('tradies')
    .update({ subscription_status: 'canceled' })
    .eq('id', tradieId)

  if (tradie?.whatsapp_number) {
    await notifyBot(
      tradie.whatsapp_number,
      'Your Docket subscription has ended. Renew at docket.com.au/billing to keep sending invoices.'
    )
  }
}

async function handleSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const tradieId = subscription.metadata?.tradie_id

  if (!tradieId) {
    console.error('subscription.updated without tradie_id in metadata')
    return
  }

  const tier = resolveTier(subscription)
  const status = mapSubscriptionStatus(subscription.status)

  await supabase
    .from('tradies')
    .update({
      subscription_status: status,
      subscription_tier: tier,
    })
    .eq('id', tradieId)
}

async function handleInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id

  if (!customerId) return

  const { data: tradie } = await supabase
    .from('tradies')
    .select('id, whatsapp_number')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!tradie) {
    console.error(`No tradie found for customer: ${customerId}`)
    return
  }

  await supabase
    .from('tradies')
    .update({ subscription_status: 'past_due' })
    .eq('id', tradie.id)

  if (tradie.whatsapp_number) {
    await notifyBot(
      tradie.whatsapp_number,
      "Heads up — your Docket payment didn't go through. Update your payment method at docket.com.au/billing to avoid losing access."
    )
  }
}

function resolveTier(subscription: Stripe.Subscription): string {
  const proPriceId = Deno.env.get('STRIPE_PRO_PRICE_ID')
  const items = subscription.items?.data ?? []
  const hasPro = items.some((item) => {
    const priceId = typeof item.price === 'string' ? item.price : item.price?.id
    return priceId === proPriceId
  })
  return hasPro ? 'pro' : 'starter'
}

function mapSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status
): string {
  const statusMap: Record<string, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'past_due',
    incomplete: 'past_due',
    incomplete_expired: 'canceled',
    paused: 'canceled',
  }
  return statusMap[stripeStatus] ?? 'active'
}

async function notifyBot(whatsappNumber: string, message: string) {
  try {
    await fetch(`${BOT_URL}/internal/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: whatsappNumber, body: message }),
    })
  } catch (err) {
    console.error('Failed to send bot notification:', err)
  }
}
