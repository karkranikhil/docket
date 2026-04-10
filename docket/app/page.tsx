import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  MessageSquareText,
  ClipboardCheck,
  Banknote,
  FileText,
  CreditCard,
  Bell,
  BarChart3,
  Smartphone,
  Mic,
  Check,
  ArrowRight,
  Terminal,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

const steps: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: MessageSquareText,
    title: "Message Docket",
    description:
      "Describe the job via text, photo, or voice note on WhatsApp. Whatever's easiest.",
  },
  {
    icon: ClipboardCheck,
    title: "Confirm your invoice",
    description:
      "Docket turns it into a proper GST invoice in seconds. Check the draft and reply YES.",
  },
  {
    icon: Banknote,
    title: "Get paid",
    description:
      "Your client gets a PDF with a pay link. Money lands in your account in 2 business days.",
  },
]

const features: {
  icon: LucideIcon
  title: string
  description: string
  className: string
}[] = [
  {
    icon: FileText,
    title: "ATO-compliant invoices",
    description:
      "ABN, GST, sequential numbering — everything the tax office wants. Automatically.",
    className: "sm:col-span-2",
  },
  {
    icon: CreditCard,
    title: "Online payment links",
    description:
      "Clients pay with one click. No chasing. No awkward phone calls.",
    className: "",
  },
  {
    icon: Bell,
    title: "Overdue reminders",
    description:
      "Automated nudges at 7, 14, and 30 days. You don't lift a finger.",
    className: "",
  },
  {
    icon: BarChart3,
    title: "Dashboard & BAS reports",
    description:
      "See what's owed, what's paid, and download quarterly BAS summaries.",
    className: "sm:col-span-2",
  },
  {
    icon: Smartphone,
    title: "Works from WhatsApp",
    description:
      "No app to install. No login to remember. Just message like you already do.",
    className: "sm:col-span-2",
  },
  {
    icon: Mic,
    title: "Voice & photo support",
    description:
      "Snap a photo of a paper docket or send a voice note — AI handles the rest.",
    className: "",
  },
]

const testimonials = [
  {
    name: "Dave Wilson",
    trade: "Plumber, Brisbane",
    quote:
      "I was losing thousands in unpaid invoices. Now I send an invoice before I've even left the job site.",
  },
  {
    name: "Karen Wu",
    trade: "Electrician, Melbourne",
    quote:
      "My clients actually pay on time now. The payment link on the invoice is a game changer.",
  },
  {
    name: "Mick O'Brien",
    trade: "Builder, Sydney",
    quote:
      "I used to do invoices on Sunday nights. Now I do them in the van between jobs.",
  },
  {
    name: "Sarah Chen",
    trade: "Painter, Perth",
    quote:
      "The BAS report alone saves me hours every quarter. Worth every cent.",
  },
  {
    name: "Tom Richards",
    trade: "Landscaper, Adelaide",
    quote:
      "My bookkeeper couldn't believe how organised my invoicing suddenly became.",
  },
  {
    name: "Jake Murray",
    trade: "Tiler, Gold Coast",
    quote:
      "Voice note to invoice in 10 seconds. I don't even have to stop what I'm doing.",
  },
]

const pricing = [
  {
    name: "Free Trial",
    price: "$0",
    period: "for 30 days",
    description: "Full access. No credit card.",
    features: [
      "Unlimited invoices",
      "WhatsApp bot",
      "Dashboard",
      "PDF invoices",
      "Payment links",
    ],
    cta: "Start free trial",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$19",
    period: "/mo",
    description: "For tradies getting started.",
    features: [
      "30 invoices/month",
      "WhatsApp bot",
      "Dashboard",
      "PDF invoices",
      "Email support",
    ],
    cta: "Get started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/mo",
    description: "For busy tradies who want it all.",
    features: [
      "Unlimited invoices",
      "Online payment links",
      "BAS export",
      "Overdue reminders",
      "Priority support",
    ],
    cta: "Go Pro",
    highlighted: true,
  },
]

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              Docket
            </span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm sm:flex">
            <a
              href="#how-it-works"
              className="text-white/50 transition-colors hover:text-white"
            >
              How it works
            </a>
            <a
              href="#features"
              className="text-white/50 transition-colors hover:text-white"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-white/50 transition-colors hover:text-white"
            >
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-white/70 transition-colors hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-all hover:bg-white/90 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center overflow-hidden px-4 pb-24 pt-24 text-center sm:pt-36">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(120,119,198,0.15),transparent_70%)]" />
        <div className="pointer-events-none absolute top-0 left-1/2 h-[500px] w-[800px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(120,119,198,0.2),transparent_60%)]" />

        <Badge className="relative mb-6 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur hover:bg-white/5">
          Built for Australian tradies
        </Badge>

        <h1 className="relative max-w-4xl text-5xl font-bold leading-[1.1] tracking-tight sm:text-7xl lg:text-8xl">
          <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            Send a WhatsApp.
          </span>
          <br />
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
            Get paid.
          </span>
        </h1>

        <p className="relative mt-8 max-w-xl text-lg leading-relaxed text-white/50 sm:text-xl">
          Docket turns your job descriptions into ATO-compliant invoices with
          payment links — all from WhatsApp. No app. No login. No behaviour
          change.
        </p>

        {/* Terminal-style command */}
        <div className="relative mt-10 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-[family-name:var(--font-mono)] text-sm backdrop-blur">
          <Terminal className="h-4 w-4 text-green-400" />
          <span className="text-white/80">
            &quot;Labour 2hrs $80/hr, tap $95, for Mick&quot;
          </span>
          <span className="animate-pulse text-white/40">|</span>
        </div>

        <div className="relative mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 text-base font-semibold text-black transition-all hover:bg-white/90 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            Start your free 30-day trial
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#how-it-works"
            className="rounded-full border border-white/20 bg-white/5 px-8 py-3 text-base font-semibold text-white transition-all hover:bg-white/10"
          >
            See how it works
          </a>
        </div>
        <p className="relative mt-5 text-sm text-white/30">
          No credit card required. Cancel anytime.
        </p>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="border-t border-white/10 px-4 py-24"
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-sm font-medium uppercase tracking-widest text-purple-400">
            How it works
          </p>
          <h2 className="mt-4 text-center text-3xl font-bold tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Three steps. Under 30 seconds.
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-center text-white/40">
            From your phone. No login required.
          </p>

          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {steps.map((step, i) => (
              <div
                key={i}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-8 transition-all hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 ring-1 ring-white/10">
                  <step.icon className="h-6 w-6 text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/40">
                  {step.description}
                </p>
                <div className="absolute right-6 top-6 text-5xl font-bold text-white/[0.03]">
                  {i + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features bento grid */}
      <section
        id="features"
        className="border-t border-white/10 px-4 py-24"
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-sm font-medium uppercase tracking-widest text-pink-400">
            Features
          </p>
          <h2 className="mt-4 text-center text-3xl font-bold tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Everything you need to get paid
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-center text-white/40">
            No accounting degree required.
          </p>

          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className={cn(
                  "group rounded-2xl border border-white/10 bg-white/[0.03] p-8 transition-all hover:border-white/20 hover:bg-white/[0.06]",
                  feature.className
                )}
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/10 transition-colors group-hover:bg-white/[0.1]">
                  <feature.icon className="h-5 w-5 text-white/60 transition-colors group-hover:text-white/80" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/40">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials marquee */}
      <section className="border-t border-white/10 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-center text-sm font-medium uppercase tracking-widest text-orange-400">
            Testimonials
          </p>
          <h2 className="mt-4 text-center text-3xl font-bold tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              What tradies are saying
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-center text-white/40">
            Real feedback from real tradies across Australia.
          </p>
        </div>

        <div className="mt-16 flex gap-6 overflow-hidden">
          <div className="flex shrink-0 animate-marquee gap-6">
            {[...testimonials, ...testimonials].map((t, i) => (
              <div
                key={i}
                className="w-[350px] shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <p className="text-sm leading-relaxed text-white/60">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-bold text-white">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{t.name}</p>
                    <p className="text-xs text-white/40">{t.trade}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="border-t border-white/10 px-4 py-24"
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-sm font-medium uppercase tracking-widest text-green-400">
            Pricing
          </p>
          <h2 className="mt-4 text-center text-3xl font-bold tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Simple, transparent pricing
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-center text-white/40">
            Start free. Upgrade when you&apos;re ready. All prices in AUD.
          </p>

          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-8 transition-all",
                  plan.highlighted
                    ? "border-purple-500/50 bg-gradient-to-b from-purple-500/10 to-transparent shadow-[0_0_40px_rgba(168,85,247,0.15)]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20"
                )}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-1 text-xs font-semibold text-white">
                      Most popular
                    </span>
                  </div>
                )}
                <h3 className="text-lg font-semibold text-white">
                  {plan.name}
                </h3>
                <div className="mt-4">
                  <span className="text-5xl font-bold text-white">
                    {plan.price}
                  </span>
                  <span className="text-white/40">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-white/40">
                  {plan.description}
                </p>
                <ul className="mt-8 flex-1 space-y-3 text-sm">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-3 text-white/60"
                    >
                      <Check className="h-4 w-4 shrink-0 text-green-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={cn(
                    "mt-8 rounded-full py-3 text-center text-sm font-semibold transition-all",
                    plan.highlighted
                      ? "bg-white text-black hover:bg-white/90 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                      : "border border-white/20 bg-white/5 text-white hover:bg-white/10"
                  )}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-white/30">
            Payment processing: 0.5% per transaction (on top of Stripe&apos;s
            1.7% + $0.30 AUD)
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-white/10 px-4 py-32 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.1),transparent_60%)]" />
        <h2 className="relative text-3xl font-bold tracking-tight sm:text-5xl">
          <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            Stop chasing invoices.
          </span>
          <br />
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
            Start getting paid.
          </span>
        </h2>
        <p className="relative mx-auto mt-6 max-w-md text-lg text-white/40">
          Join thousands of Aussie tradies who invoice straight from WhatsApp.
        </p>
        <Link
          href="/signup"
          className="relative mt-10 inline-block rounded-full bg-white px-8 py-3 text-base font-semibold text-black transition-all hover:bg-white/90 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
        >
          Start your free trial
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-white/30">
            &copy; {new Date().getFullYear()} Docket. Built in Australia.
          </p>
          <div className="flex gap-6 text-sm">
            <Link
              href="/login"
              className="text-white/30 transition-colors hover:text-white/60"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-white/30 transition-colors hover:text-white/60"
            >
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
