import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const steps = [
  {
    number: "1",
    title: "Message Docket on WhatsApp",
    description:
      "Describe the job — text, photo of the docket, or a voice note. Whatever's easiest.",
  },
  {
    number: "2",
    title: "Confirm your invoice",
    description:
      "Docket turns it into a proper GST invoice in seconds. Check the draft and reply YES.",
  },
  {
    number: "3",
    title: "Get paid",
    description:
      "Your client gets a PDF with a pay link. Money lands in your account within 2 business days.",
  },
]

const features = [
  {
    title: "ATO-compliant invoices",
    description: "ABN, GST, sequential numbering — everything the tax office wants.",
  },
  {
    title: "Stripe payment links",
    description: "Clients pay online. No chasing. No awkward phone calls.",
  },
  {
    title: "Overdue reminders",
    description: "Automated nudges at 7, 14, and 30 days. You don't lift a finger.",
  },
  {
    title: "Dashboard & reports",
    description: "See what's owed, what's paid, and download BAS summaries.",
  },
  {
    title: "Works from WhatsApp",
    description: "No app to install. No login to remember. Just message like you already do.",
  },
  {
    title: "Voice & photo support",
    description: "Snap a photo of a paper docket or send a voice note — Docket handles it.",
  },
]

const pricing = [
  {
    name: "Free Trial",
    price: "$0",
    period: "for 30 days",
    description: "Full access. No credit card.",
    features: ["Unlimited invoices", "WhatsApp bot", "Dashboard", "PDF invoices"],
    cta: "Start free trial",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$19",
    period: "/month",
    description: "For tradies getting started.",
    features: ["30 invoices/month", "WhatsApp bot", "Dashboard", "PDF invoices"],
    cta: "Get started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    description: "For busy tradies who want it all.",
    features: [
      "Unlimited invoices",
      "Stripe payment links",
      "BAS export",
      "Priority support",
    ],
    cta: "Go Pro",
    highlighted: true,
  },
]

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Docket
          </Link>
          <nav className="hidden items-center gap-6 text-sm sm:flex">
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
              How it works
            </a>
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-24 sm:py-32 text-center">
        <Badge variant="secondary" className="mb-4">
          Built for Australian tradies
        </Badge>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Send a WhatsApp.{" "}
          <span className="text-muted-foreground">Get paid.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed">
          Docket turns your job descriptions into ATO-compliant invoices with
          payment links — all from WhatsApp. No app. No login. No behaviour
          change.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: "lg" }))}
          >
            Start your free 30-day trial
          </Link>
          <a
            href="#how-it-works"
            className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
          >
            See how it works
          </a>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          No credit card required. Cancel anytime.
        </p>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t bg-muted/40 px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            Three steps. Under 30 seconds. From your phone.
          </p>
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="flex flex-col items-center text-center sm:items-start sm:text-left">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background text-sm font-bold">
                  {step.number}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to get paid
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            No accounting degree required.
          </p>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="border bg-card">
                <CardContent className="pt-6">
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t bg-muted/40 px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Simple pricing
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            Start free. Upgrade when you&apos;re ready. All prices in AUD.
          </p>
          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {pricing.map((plan) => (
              <Card
                key={plan.name}
                className={
                  plan.highlighted
                    ? "relative border-2 border-foreground shadow-lg"
                    : "border"
                }
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge>Most popular</Badge>
                  </div>
                )}
                <CardContent className="flex flex-col pt-6">
                  <h3 className="font-semibold">{plan.name}</h3>
                  <div className="mt-3">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                  <ul className="mt-6 space-y-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <span className="text-green-600">&#10003;</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className={cn(
                      buttonVariants({
                        variant: plan.highlighted ? "default" : "outline",
                      }),
                      "mt-8"
                    )}
                  >
                    {plan.cta}
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Payment processing: 0.5% per transaction (on top of Stripe&apos;s
            1.7% + $0.30 AUD)
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t px-4 py-24 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Stop chasing invoices. Start getting paid.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-muted-foreground">
          Join thousands of Aussie tradies who invoice straight from WhatsApp.
        </p>
        <Link
          href="/signup"
          className={cn(buttonVariants({ size: "lg" }), "mt-8")}
        >
          Start your free trial
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <p>&copy; {new Date().getFullYear()} Docket. Built in Australia.</p>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-foreground transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
