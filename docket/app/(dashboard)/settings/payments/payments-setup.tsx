'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type PaymentState = 'not_setup' | 'pending' | 'active'

export function PaymentsSetup({ state }: { state: PaymentState }) {
  const [loading, setLoading] = useState(false)

  async function handleSetup() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' })
      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setLoading(false)
    }
  }

  if (state === 'active') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Online payments</CardTitle>
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
              Active
            </Badge>
          </div>
          <CardDescription>
            Your clients can pay invoices online. Payments go straight to your bank account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-900">
              Everything&apos;s set up. Payment links are automatically added to your invoices.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (state === 'pending') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Online payments</CardTitle>
            <Badge variant="secondary">Setup incomplete</Badge>
          </div>
          <CardDescription>
            You started setting up payments but didn&apos;t finish. Pick up where you left off.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">
              Your invoices are being sent without a payment link. Finish setup so clients can pay online.
            </p>
          </div>
          <Button onClick={handleSetup} disabled={loading}>
            {loading ? 'Loading...' : 'Complete setup'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Get paid faster</CardTitle>
        <CardDescription>
          Add a bank account so clients can pay your invoices online.
          Takes 2 minutes. Money lands in your account within 2 business days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-green-600">&#10003;</span>
            Clients get a &quot;Pay now&quot; link on every invoice
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-green-600">&#10003;</span>
            You get a WhatsApp notification when they pay
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-green-600">&#10003;</span>
            Money goes straight to your bank — no middleman
          </li>
        </ul>
        <Button onClick={handleSetup} disabled={loading} size="lg">
          {loading ? 'Loading...' : 'Set up payments'}
        </Button>
      </CardContent>
    </Card>
  )
}
