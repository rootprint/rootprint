<script lang="ts">
  import {
    WebsiteName,
    WebsiteBaseUrl,
    WebsiteDescription,
  } from "./../../config"
  import { reveal } from "$lib/actions/reveal"
  import { onMount } from "svelte"
  import { fly } from "svelte/transition"
  import { cubicOut } from "svelte/easing"

  const phrases = ["No bloat.", "No vendor lock-in.", "Just your logs."]
  let phraseIndex = $state(0)

  const installCommands = [
    "curl -O https://raw.githubusercontent.com/oleksandr-zhyhalo/logwiz/main/docs-site/files/docker-compose.yml",
    "docker compose up -d",
  ]
  let copyState = $state<"idle" | "copied" | "failed">("idle")
  let copyTimeout: ReturnType<typeof setTimeout> | undefined

  async function copyInstallCommand() {
    if (copyTimeout) clearTimeout(copyTimeout)
    try {
      await navigator.clipboard.writeText(installCommands.join("\n"))
      copyState = "copied"
    } catch {
      copyState = "failed"
    }
    copyTimeout = setTimeout(() => {
      copyState = "idle"
    }, 2000)
  }

  onMount(() => {
    const interval = setInterval(() => {
      phraseIndex = (phraseIndex + 1) % phrases.length
    }, 1800)
    return () => {
      clearInterval(interval)
      if (copyTimeout) clearTimeout(copyTimeout)
    }
  })

  const ldJson = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: WebsiteName,
    url: WebsiteBaseUrl,
  }
  const jsonldScript = `<script type="application/ld+json">${
    JSON.stringify(ldJson) + "<"
  }/script>`
  const socialImageUrl = `${WebsiteBaseUrl}/images/home-image.png`
  const capabilityTabId = (index: number) => `capability-tab-${index}`
  const capabilityPanelId = (index: number) => `capability-panel-${index}`

  let activeTab = $state(0)
  let tabsContainer: HTMLElement
  let tabIndicatorStyle = $state("")
  let windowWidth = $state(0)

  function selectCapability(index: number) {
    activeTab = index
  }

  function focusCapability(index: number) {
    requestAnimationFrame(() => {
      const buttons = tabsContainer?.querySelectorAll('[role="tab"]')
      const nextButton = buttons?.[index] as HTMLElement | undefined
      nextButton?.focus()
    })
  }

  function onCapabilityKeydown(event: KeyboardEvent, index: number) {
    let nextIndex = index

    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % capabilities.length
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + capabilities.length) % capabilities.length
    } else if (event.key === "Home") {
      nextIndex = 0
    } else if (event.key === "End") {
      nextIndex = capabilities.length - 1
    } else {
      return
    }

    event.preventDefault()
    selectCapability(nextIndex)
    focusCapability(nextIndex)
  }

  $effect(() => {
    const idx = activeTab
    const _ = windowWidth
    requestAnimationFrame(() => {
      if (!tabsContainer) return
      const buttons = tabsContainer.querySelectorAll('[role="tab"]')
      const activeButton = buttons[idx] as HTMLElement
      if (!activeButton) return
      tabIndicatorStyle = `left: ${activeButton.offsetLeft}px; width: ${activeButton.offsetWidth}px;`
    })
  })

  const capabilities = [
    {
      name: "Search & Filter",
      visual: "search",
      description: [
        "Full-text search across all your logs",
        "One-click filters with field aggregation counts",
        "Real-time frequency histogram for log volume",
      ],
    },
    {
      name: "Ingestion",
      visual: "ingest",
      description: [
        "OTLP HTTP endpoint — works with any OpenTelemetry SDK or Collector",
        "Drop-in guides for Python, Node.js, Go, Java, and .NET",
        "NDJSON gateway for custom-schema indexes",
        "Per-index bearer tokens, 10 MB max per request",
      ],
    },
    {
      name: "Export & Share",
      visual: "export",
      description: [
        "Download as NDJSON, CSV, or plain text",
        "Bookmark frequently used searches",
        "Share queries via shareable links",
      ],
    },
    {
      name: "User Management",
      visual: "users",
      description: [
        "Invite-based access with role-based permissions",
        "Admin and user roles with per-index visibility",
        "Optional Google OAuth SSO with domain restrictions",
      ],
    },
  ]

  const features: {
    category: string
    name: string | null
    description: string | null
    visual: "search" | "context" | "docker" | "cost" | "otel" | "opensource"
    tone: "light" | "dark"
    span: 2 | 3
  }[] = [
    {
      category: "Performance",
      name: "Fast search",
      description:
        "Full-text search powered by Quickwit. Sub-second queries across millions of log entries stored directly on object storage.",
      visual: "search",
      tone: "light",
      span: 2,
    },
    {
      category: "Logs",
      name: "See your logs",
      description:
        "A readable log view with severity highlights, structured fields, and one-click filters — so you can work through production without fighting your tools.",
      visual: "context",
      tone: "dark",
      span: 3,
    },
    {
      category: "Infrastructure",
      name: "One command, self-hosted",
      description:
        "Run on your own infrastructure. Your data never leaves your network. Deploy with a single Docker Compose command.",
      visual: "docker",
      tone: "dark",
      span: 3,
    },
    {
      category: "Cost",
      name: "Cost effective",
      description:
        "Store logs directly on S3 or compatible object storage. Dramatically lower costs compared to Elasticsearch-based tools.",
      visual: "cost",
      tone: "light",
      span: 2,
    },
    {
      category: "OpenTelemetry",
      name: "Standards, not lock-in",
      description:
        "Speak OTLP on the way in. Store logs on storage you already own. Your data stays readable without Logwiz — open formats, no proprietary wire protocol.",
      visual: "otel",
      tone: "light",
      span: 2,
    },
    {
      category: "Open source",
      name: null,
      description: null,
      visual: "opensource",
      tone: "dark",
      span: 3,
    },
  ]
</script>

<svelte:head>
  <title>{WebsiteName}</title>
  <meta name="description" content={WebsiteDescription} />
  <link rel="canonical" href={WebsiteBaseUrl} />
  <meta property="og:title" content={WebsiteName} />
  <meta property="og:description" content={WebsiteDescription} />
  <meta property="og:url" content={WebsiteBaseUrl} />
  <meta property="og:type" content="website" />
  <meta property="og:image" content={socialImageUrl} />
  <meta property="og:image:alt" content="Logwiz product interface preview" />
  <meta property="og:site_name" content={WebsiteName} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={WebsiteName} />
  <meta name="twitter:description" content={WebsiteDescription} />
  <meta name="twitter:image" content={socialImageUrl} />
  <meta name="twitter:image:alt" content="Logwiz product interface preview" />
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html jsonldScript}
</svelte:head>

<svelte:window bind:innerWidth={windowWidth} />

<!-- Unified hero + capabilities background -->
<div class="relative overflow-hidden">
  <!-- Dot pattern -->
  <div
    class="absolute inset-0 pointer-events-none"
    style="background-image: radial-gradient(circle, oklch(14% 0 0 / 0.06) 1px, transparent 1px); background-size: 24px 24px;"
  ></div>
  <!-- Green glow (repositioned for the taller wrapper) -->
  <div
    class="absolute inset-0 pointer-events-none"
    style="background: radial-gradient(ellipse 80% 40% at 10% 22%, oklch(62% 0.14 160 / 0.08), transparent);"
  ></div>
  <!-- Fade to white toward the bottom of Capabilities -->
  <div
    class="absolute inset-0 pointer-events-none"
    style="background: linear-gradient(to bottom, transparent 0%, transparent 55%, oklch(100% 0 0) 100%);"
  ></div>

  <!-- Hero -->
  <section class="relative">
    <div class="max-w-[1200px] mx-auto px-6 pt-20 pb-0 w-full relative z-[2]">
      <!-- Centered text content -->
      <div class="text-center max-w-[720px] mx-auto">
        <div class="flex justify-center mb-8" use:reveal={{ delay: 0 }}>
          <span
            class="inline-flex items-center gap-2 rounded-full border border-base-300 bg-white/60 backdrop-blur-sm px-3 py-1"
          >
            <span
              class="h-1.5 w-1.5 rounded-full bg-[oklch(62%_0.14_160)]"
              aria-hidden="true"
            ></span>
            <span
              class="text-xs uppercase tracking-wider text-neutral font-medium"
            >
              Open-source log management
            </span>
          </span>
        </div>
        <h1
          class="text-5xl md:text-7xl font-bold text-base-content leading-[1.05] tracking-tighter"
          style="text-wrap: balance"
          use:reveal={{ delay: 80 }}
        >
          Search your logs directly on <span class="highlight-accent"
            >cloud storage</span
          >
        </h1>
        <p
          class="text-lg text-neutral mt-6 max-w-[50ch] mx-auto leading-relaxed"
          use:reveal={{ delay: 160 }}
        >
          A fast, self-hosted log management platform.
        </p>
        <p
          class="mt-3 h-8 overflow-hidden relative"
          use:reveal={{ delay: 200 }}
        >
          {#key phraseIndex}
            <span
              class="absolute inset-0 inline-flex items-center justify-center text-lg font-semibold text-base-content"
              in:fly={{ y: 24, duration: 350, easing: cubicOut }}
              out:fly={{ y: -24, duration: 250, easing: cubicOut }}
            >
              {phrases[phraseIndex]}
            </span>
          {/key}
        </p>
        <div
          class="mt-8 flex flex-wrap gap-4 justify-center"
          use:reveal={{ delay: 280 }}
        >
          <a
            href="https://docs.logwiz.io"
            class="bg-base-content text-base-100 px-6 py-2.5 rounded-lg text-sm font-medium btn-lift transition-[transform,box-shadow] duration-200 ease-out-custom"
          >
            Get started
          </a>
          <a
            href="https://github.com/oleksandr-zhyhalo/logwiz"
            class="inline-flex items-center gap-2 border border-base-300 text-base-content px-6 py-2.5 rounded-lg text-sm font-medium btn-lift hover:bg-base-200 transition-[transform,box-shadow,background-color] duration-200 ease-out-custom"
          >
            <svg
              class="w-4 h-4 shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M12 .5C5.73.5.67 5.57.67 11.85c0 5.02 3.24 9.27 7.74 10.77.57.11.78-.25.78-.55 0-.27-.01-1.18-.02-2.14-3.15.69-3.81-1.34-3.81-1.34-.52-1.3-1.27-1.65-1.27-1.65-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.19 1.75 1.19 1.02 1.76 2.68 1.25 3.33.96.1-.74.4-1.25.73-1.54-2.51-.29-5.15-1.26-5.15-5.62 0-1.24.44-2.25 1.17-3.04-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.15 1.16a10.93 10.93 0 0 1 5.74 0c2.18-1.47 3.14-1.16 3.14-1.16.62 1.57.23 2.73.11 3.02.73.79 1.16 1.8 1.16 3.04 0 4.37-2.64 5.33-5.16 5.61.41.35.78 1.05.78 2.12 0 1.53-.01 2.77-.01 3.15 0 .31.21.67.79.55 4.5-1.5 7.73-5.75 7.73-10.77C23.33 5.57 18.27.5 12 .5z"
              />
            </svg>
            View on GitHub
          </a>
        </div>
        <p
          class="mt-6 text-sm text-neutral flex flex-wrap items-center justify-center gap-2"
          use:reveal={{ delay: 360 }}
        >
          <span class="font-medium">Perfect for</span>
          <span
            class="px-2.5 py-0.5 rounded-full border border-base-300 text-xs font-medium text-base-content transition-[background-color,border-color] duration-150 ease-out-custom hover:bg-base-200 hover:border-base-content/10"
            >OTEL-native ingestion</span
          >
          <span
            class="px-2.5 py-0.5 rounded-full border border-base-300 text-xs font-medium text-base-content transition-[background-color,border-color] duration-150 ease-out-custom hover:bg-base-200 hover:border-base-content/10"
            >High-volume logs</span
          >
          <span
            class="px-2.5 py-0.5 rounded-full border border-base-300 text-xs font-medium text-base-content transition-[background-color,border-color] duration-150 ease-out-custom hover:bg-base-200 hover:border-base-content/10"
            >IoT devices</span
          >
        </p>
      </div>

      <!-- Hero image with fade and pulsation -->
      <div
        class="relative mt-16 max-w-[960px] mx-auto"
        use:reveal={{ delay: 450 }}
      >
        <!-- Pulsating glow around top -->
        <div
          class="hero-glow absolute -top-8 left-1/2 -translate-x-1/2 w-[80%] h-[120px] rounded-full pointer-events-none"
          style="background: radial-gradient(ellipse 100% 100% at 50% 100%, oklch(62% 0.14 160 / 0.25), transparent); filter: blur(30px);"
        ></div>

        <!-- Image container with bottom fade -->
        <div
          class="relative"
          style="-webkit-mask-image: linear-gradient(to bottom, black 40%, transparent 95%); mask-image: linear-gradient(to bottom, black 40%, transparent 95%);"
        >
          <div
            class="rounded-xl border border-base-300 bg-white overflow-hidden shadow-[0_2px_4px_rgba(9,9,11,0.04),0_16px_32px_-8px_rgba(9,9,11,0.1)]"
          >
            <img
              src="/images/home-image.png"
              alt="Logwiz log search interface"
              class="w-full h-auto block"
            />
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Capabilities -->
  <section id="capabilities" class="py-24 relative scroll-mt-20">
    <div class="max-w-[1200px] mx-auto px-6 relative z-[2]">
      <p
        class="text-xs uppercase tracking-wider text-neutral font-medium mb-3"
        use:reveal
      >
        Capabilities
      </p>
      <h2
        class="text-3xl md:text-5xl font-semibold text-base-content tracking-tight mb-14"
        style="text-wrap: balance"
        use:reveal={{ delay: 60 }}
      >
        What you can do with Logwiz
      </h2>

      <!-- Tabs -->
      <div
        bind:this={tabsContainer}
        class="relative flex gap-2 overflow-x-auto border-b border-base-300 pb-px"
        role="tablist"
        aria-label="Capabilities"
      >
        {#each capabilities as cap, i}
          <button
            type="button"
            id={capabilityTabId(i)}
            role="tab"
            aria-selected={activeTab === i}
            aria-controls={capabilityPanelId(i)}
            tabindex={activeTab === i ? 0 : -1}
            class="relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-200 ease-out-custom {activeTab ===
            i
              ? 'text-base-content'
              : 'text-neutral hover:text-base-content'}"
            onclick={() => selectCapability(i)}
            onkeydown={(event) => onCapabilityKeydown(event, i)}
          >
            {cap.name}
          </button>
        {/each}
        <span
          class="absolute bottom-0 h-[2px] bg-base-content rounded-full transition-[left,width] duration-250 {tabIndicatorStyle
            ? ''
            : 'opacity-0'}"
          style="{tabIndicatorStyle} transition-timing-function: var(--ease-spring);"
        ></span>
      </div>

      <!-- Tab content: modest min-h stabilises layout between tabs without padding short mocks with whitespace -->
      <div class="pt-14 pb-4 min-h-[560px] md:min-h-[360px]">
        {#key activeTab}
          <div
            id={capabilityPanelId(activeTab)}
            role="tabpanel"
            aria-labelledby={capabilityTabId(activeTab)}
            tabindex="0"
            class="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-12 items-start animate-[fadeSlideIn_400ms_cubic-bezier(0.16,1,0.3,1)]"
          >
            <div class="pt-2">
              <h3
                class="text-xl font-semibold text-base-content tracking-tight mb-4"
              >
                {capabilities[activeTab].name}
              </h3>
              <ul class="flex flex-col gap-2.5 max-w-[45ch]">
                {#each capabilities[activeTab].description as item}
                  <li
                    class="flex items-start gap-2.5 text-base text-neutral leading-relaxed"
                  >
                    <span
                      class="mt-[9px] h-1.5 w-1.5 rounded-full bg-neutral/30 shrink-0"
                    ></span>
                    {item}
                  </li>
                {/each}
              </ul>
            </div>
            <div
              class="bg-white rounded-xl overflow-hidden border border-base-300 shadow-[0_1px_3px_0_rgba(9,9,11,0.04),0_8px_20px_-4px_rgba(9,9,11,0.06)] text-sm md:h-[360px]"
            >
              {#if capabilities[activeTab].visual === "search"}
                <!-- Mini app chrome -->
                <div
                  class="flex items-center gap-2 px-4 py-2 border-b border-base-200 bg-base-200/50"
                >
                  <div
                    class="text-xs bg-white border border-base-300 rounded px-2 py-1 text-base-content flex items-center gap-1"
                  >
                    prod-logs-v2
                    <svg
                      class="w-3 h-3 text-neutral/40"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"><path d="m6 9 6 6 6-6" /></svg
                    >
                  </div>
                </div>
                <div class="grid grid-cols-[100px_1fr]">
                  <!-- Sidebar fields -->
                  <div class="border-r border-base-200 p-3 text-xs space-y-2.5">
                    <p
                      class="text-neutral/50 font-medium text-[10px] uppercase tracking-wider"
                    >
                      Fields
                    </p>
                    <div>
                      <p class="text-base-content font-medium mb-1">level</p>
                      <div class="space-y-1">
                        <div class="flex items-center gap-1.5">
                          <span class="w-2 h-2 rounded-full bg-[#ef4444]"
                          ></span><span class="text-base-content/70">error</span
                          ><span class="text-neutral/30 ml-auto tabular-nums"
                            >68%</span
                          >
                        </div>
                        <div class="flex items-center gap-1.5">
                          <span class="w-2 h-2 rounded-full bg-[#f59e0b]"
                          ></span><span class="text-base-content/70">warn</span
                          ><span class="text-neutral/30 ml-auto tabular-nums"
                            >22%</span
                          >
                        </div>
                        <div class="flex items-center gap-1.5">
                          <span class="w-2 h-2 rounded-full bg-[#3b82f6]"
                          ></span><span class="text-base-content/70">info</span
                          ><span class="text-neutral/30 ml-auto tabular-nums"
                            >10%</span
                          >
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- Main content -->
                  <div class="p-3">
                    <!-- Query input -->
                    <div
                      class="flex items-center gap-2 rounded bg-base-100 border border-base-300 px-2.5 py-1.5 mb-3"
                    >
                      <svg
                        class="w-3 h-3 text-neutral/40 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                        ><circle cx="11" cy="11" r="8" /><path
                          d="m21 21-4.3-4.3"
                        /></svg
                      >
                      <span class="text-base-content text-xs font-mono"
                        >level:error AND service:api</span
                      >
                    </div>
                    <!-- Frequency chart -->
                    <div class="flex items-end gap-px h-9 mb-3">
                      {#each [14, 23, 20, 29, 16, 25, 32, 22, 18, 27, 30, 20, 16, 25, 22, 18, 29, 23, 27, 16, 20, 32, 25, 22] as h}
                        <div class="flex-1 flex flex-col justify-end">
                          <div
                            class="bg-[#ef4444]/70 rounded-t-[1px]"
                            style="height: {Math.round(h * 0.7)}px"
                          ></div>
                          <div
                            class="bg-[#f59e0b]/70"
                            style="height: {Math.round(h * 0.2)}px"
                          ></div>
                          <div
                            class="bg-[#3b82f6]/70 rounded-b-[1px]"
                            style="height: {Math.max(1, Math.round(h * 0.1))}px"
                          ></div>
                        </div>
                      {/each}
                    </div>
                    <!-- Log header -->
                    <div
                      class="flex gap-2 text-[10px] text-neutral/50 uppercase tracking-wider font-medium py-1 border-b border-base-200 bg-base-200/30 border-l-[3px] border-l-transparent pl-2 pr-1"
                    >
                      <span class="w-16 shrink-0">timestamp</span>
                      <span class="text-neutral/30">|</span>
                      <span class="w-14 shrink-0">service</span>
                      <span class="text-neutral/30">|</span>
                      <span class="flex-1">message</span>
                    </div>
                    <!-- Log rows with left border severity -->
                    <div class="font-mono text-[11px] leading-none">
                      <div
                        class="flex gap-2 py-[5px] border-l-[3px] border-l-[#ef4444] pl-2 hover:bg-base-100 transition-[background-color] duration-150 ease-out-custom"
                      >
                        <span class="text-neutral/40 w-16 shrink-0"
                          >10:32:01</span
                        ><span class="text-neutral/30">|</span><span
                          class="text-base-content/60 w-14 shrink-0">api</span
                        ><span class="text-neutral/30">|</span><span
                          class="text-base-content/80 truncate"
                          >Connection timeout after 30s</span
                        >
                      </div>
                      <div
                        class="flex gap-2 py-[5px] border-l-[3px] border-l-[#ef4444] pl-2 hover:bg-base-100 transition-[background-color] duration-150 ease-out-custom"
                      >
                        <span class="text-neutral/40 w-16 shrink-0"
                          >10:32:00</span
                        ><span class="text-neutral/30">|</span><span
                          class="text-base-content/60 w-14 shrink-0">api</span
                        ><span class="text-neutral/30">|</span><span
                          class="text-base-content/80 truncate"
                          >Failed to process request id=a8f2c</span
                        >
                      </div>
                      <div
                        class="flex gap-2 py-[5px] border-l-[3px] border-l-[#ef4444] pl-2 hover:bg-base-100 transition-[background-color] duration-150 ease-out-custom"
                      >
                        <span class="text-neutral/40 w-16 shrink-0"
                          >10:31:58</span
                        ><span class="text-neutral/30">|</span><span
                          class="text-base-content/60 w-14 shrink-0">api</span
                        ><span class="text-neutral/30">|</span><span
                          class="text-base-content/80 truncate"
                          >Database connection refused</span
                        >
                      </div>
                      <div
                        class="flex gap-2 py-[5px] border-l-[3px] border-l-[#f59e0b] pl-2 hover:bg-base-100 transition-[background-color] duration-150 ease-out-custom"
                      >
                        <span class="text-neutral/40 w-16 shrink-0"
                          >10:31:57</span
                        ><span class="text-neutral/30">|</span><span
                          class="text-base-content/60 w-14 shrink-0">auth</span
                        ><span class="text-neutral/30">|</span><span
                          class="text-base-content/80 truncate"
                          >Retry attempt 3/5</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
              {:else if capabilities[activeTab].visual === "ingest"}
                <div class="p-5">
                  <!-- Endpoint -->
                  <div class="flex items-center gap-2 mb-1">
                    <span
                      class="text-xs font-semibold bg-emerald-50 text-emerald-600 rounded px-2 py-0.5"
                      >POST</span
                    >
                    <span class="text-xs font-mono text-base-content"
                      >/api/otlp/v1/logs</span
                    >
                  </div>
                  <p class="text-[11px] text-neutral/40 mb-4">
                    OTLP endpoint · NDJSON at <span class="font-mono"
                      >/api/ingest/&#123;indexId&#125;</span
                    >
                  </p>
                  <!-- Env snippet -->
                  <div
                    class="bg-base-100 rounded-lg border border-base-300 p-3 mb-4 font-mono text-xs leading-relaxed text-base-content/70"
                  >
                    <p
                      class="text-neutral/40 mb-1 font-sans text-[10px] uppercase tracking-wider font-medium"
                    >
                      Point any OTEL SDK at Logwiz
                    </p>
                    <span class="text-primary">OTEL_EXPORTER_OTLP_ENDPOINT</span
                    >=https://logwiz.internal/api<br />
                    <span class="text-primary">OTEL_EXPORTER_OTLP_HEADERS</span
                    >=<span class="text-primary"
                      >"Authorization=Bearer lwit_a7f3..."</span
                    >
                  </div>
                  <!-- Tokens -->
                  <div class="mt-4">
                    <div class="flex items-center justify-between mb-3">
                      <p class="text-xs font-medium text-base-content">
                        Ingest tokens
                      </p>
                      <span
                        class="text-[11px] bg-base-content text-base-100 rounded px-2 py-0.5 font-medium"
                        >Create token</span
                      >
                    </div>
                    <div class="space-y-0 divide-y divide-base-200 text-xs">
                      <div class="flex items-center gap-3 py-2">
                        <span class="text-base-content font-medium"
                          >production</span
                        >
                        <span class="text-neutral/40 font-mono"
                          >lwit_a7f3...</span
                        >
                        <span class="text-neutral/30 ml-auto"
                          >Last used 2m ago</span
                        >
                      </div>
                      <div class="flex items-center gap-3 py-2">
                        <span class="text-base-content font-medium"
                          >staging</span
                        >
                        <span class="text-neutral/40 font-mono"
                          >lwit_9bk2...</span
                        >
                        <span class="text-neutral/30 ml-auto"
                          >Last used 1h ago</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
              {:else if capabilities[activeTab].visual === "export"}
                <div class="p-5">
                  <!-- Export dialog header -->
                  <p class="text-base-content text-sm font-medium mb-1">
                    Export Logs
                  </p>
                  <p class="text-[11px] text-neutral/40 mb-5">
                    1,247 logs matching your query
                  </p>

                  <!-- Format selector -->
                  <p class="text-xs text-neutral/50 mb-2">Format</p>
                  <div
                    class="inline-flex border border-base-300 rounded-lg overflow-hidden mb-6"
                  >
                    <span
                      class="text-xs bg-base-content text-base-100 px-3 py-1.5 font-medium"
                      >NDJSON</span
                    >
                    <span
                      class="text-xs bg-white px-3 py-1.5 text-neutral border-l border-base-300"
                      >CSV</span
                    >
                    <span
                      class="text-xs bg-white px-3 py-1.5 text-neutral border-l border-base-300"
                      >Text</span
                    >
                  </div>

                  <!-- Progress -->
                  <div class="mb-6">
                    <div
                      class="flex items-center justify-between text-xs mb-1.5"
                    >
                      <span class="text-base-content"
                        >Fetching 1,247 / 1,247 logs...</span
                      >
                      <span class="text-neutral/40">100%</span>
                    </div>
                    <div class="h-1.5 bg-base-200 rounded-full overflow-hidden">
                      <div
                        class="h-full bg-primary rounded-full"
                        style="width: 100%"
                      ></div>
                    </div>
                  </div>

                  <!-- Download ready -->
                  <div
                    class="flex items-center gap-3 bg-base-100 border border-base-300 rounded-lg px-4 py-3"
                  >
                    <svg
                      class="w-4 h-4 text-primary shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                      ><path
                        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                      /><polyline points="7 10 12 15 17 10" /><line
                        x1="12"
                        y1="15"
                        x2="12"
                        y2="3"
                      /></svg
                    >
                    <div class="flex-1 min-w-0">
                      <p class="text-xs text-base-content font-medium">
                        export-2026-04-14.ndjson.gz
                      </p>
                      <p class="text-[10px] text-neutral/40">
                        2.4 MB compressed
                      </p>
                    </div>
                    <span class="text-xs text-primary font-medium shrink-0"
                      >Download</span
                    >
                  </div>
                </div>
              {:else if capabilities[activeTab].visual === "users"}
                <div class="p-5">
                  <div class="flex items-center justify-between mb-4">
                    <div>
                      <p class="text-base-content text-sm font-medium">Users</p>
                    </div>
                    <span
                      class="text-xs bg-base-content text-base-100 rounded-md px-2.5 py-1 font-medium"
                      >Invite User</span
                    >
                  </div>
                  <!-- User table -->
                  <div class="text-xs">
                    <!-- Header -->
                    <div
                      class="grid grid-cols-[1fr_1fr_auto_auto] gap-3 py-2 border-b border-base-200 text-neutral/40 text-[10px] uppercase tracking-wider font-medium"
                    >
                      <span>Name</span>
                      <span>Email</span>
                      <span class="w-16 text-center">Status</span>
                      <span class="w-14 text-center">Role</span>
                    </div>
                    <!-- Rows -->
                    <div
                      class="grid grid-cols-[1fr_1fr_auto_auto] gap-3 py-2.5 border-b border-base-100 items-center"
                    >
                      <span class="text-base-content font-medium"
                        >Marta Richter</span
                      >
                      <span class="text-neutral/50">marta@acmecorp.io</span>
                      <span class="w-16 text-center"
                        ><span
                          class="bg-emerald-50 text-emerald-600 rounded px-1.5 py-0.5 text-[10px] font-medium"
                          >Active</span
                        ></span
                      >
                      <span class="w-14 text-center"
                        ><span
                          class="bg-base-content text-base-100 rounded px-1.5 py-0.5 text-[10px] font-medium"
                          >Admin</span
                        ></span
                      >
                    </div>
                    <div
                      class="grid grid-cols-[1fr_1fr_auto_auto] gap-3 py-2.5 border-b border-base-100 items-center"
                    >
                      <span class="text-base-content font-medium"
                        >Jonas Kowalski</span
                      >
                      <span class="text-neutral/50">jonas.k@acmecorp.io</span>
                      <span class="w-16 text-center"
                        ><span
                          class="bg-blue-50 text-blue-600 rounded px-1.5 py-0.5 text-[10px] font-medium"
                          >Google</span
                        ></span
                      >
                      <span class="w-14 text-center"
                        ><span
                          class="bg-base-200 text-neutral rounded px-1.5 py-0.5 text-[10px]"
                          >Member</span
                        ></span
                      >
                    </div>
                    <div
                      class="grid grid-cols-[1fr_1fr_auto_auto] gap-3 py-2.5 border-b border-base-100 items-center"
                    >
                      <span class="text-base-content font-medium"
                        >Sun-hee Lee</span
                      >
                      <span class="text-neutral/50">sunhee@acmecorp.io</span>
                      <span class="w-16 text-center"
                        ><span
                          class="bg-amber-50 text-amber-600 rounded px-1.5 py-0.5 text-[10px] font-medium"
                          >Pending</span
                        ></span
                      >
                      <span class="w-14 text-center"
                        ><span
                          class="bg-base-200 text-neutral rounded px-1.5 py-0.5 text-[10px]"
                          >Member</span
                        ></span
                      >
                    </div>
                    <div
                      class="grid grid-cols-[1fr_1fr_auto_auto] gap-3 py-2.5 border-b border-base-100 items-center"
                    >
                      <span class="text-base-content font-medium"
                        >Ayşe Demir</span
                      >
                      <span class="text-neutral/50">ayse@acmecorp.io</span>
                      <span class="w-16 text-center"
                        ><span
                          class="bg-emerald-50 text-emerald-600 rounded px-1.5 py-0.5 text-[10px] font-medium"
                          >Active</span
                        ></span
                      >
                      <span class="w-14 text-center"
                        ><span
                          class="bg-base-200 text-neutral rounded px-1.5 py-0.5 text-[10px]"
                          >Member</span
                        ></span
                      >
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/key}
      </div>
    </div>
  </section>
</div>

<!-- Built for developers -->
<section
  id="for-developers"
  class="bg-base-200 py-20 relative overflow-hidden scroll-mt-20"
>
  <div
    class="absolute inset-0 pointer-events-none"
    style="background-image: radial-gradient(circle, oklch(14% 0 0 / 0.04) 1px, transparent 1px); background-size: 24px 24px;"
  ></div>
  <div class="max-w-[1200px] mx-auto px-6 relative">
    <p
      class="text-xs uppercase tracking-wider text-neutral font-medium mb-3"
      use:reveal
    >
      — For developers
    </p>
    <h2
      class="text-3xl md:text-5xl font-semibold text-base-content mb-4 tracking-tight"
      style="text-wrap: balance"
      use:reveal={{ delay: 60 }}
    >
      Built for developers
    </h2>
    <p
      class="text-lg text-neutral leading-relaxed max-w-[55ch] mb-14"
      use:reveal={{ delay: 120 }}
    >
      Every layer is designed for the people who run production — readable
      queries, honest latencies, infrastructure you control.
    </p>

    <div class="grid grid-cols-1 md:grid-cols-5 gap-6">
      {#each features as feature, i (feature.visual)}
        <div
          class="rounded-xl border p-6 flex flex-col {i >= 4
            ? 'min-h-[220px]'
            : 'min-h-[320px]'} {feature.span === 2
            ? 'md:col-span-2'
            : 'md:col-span-3'} {feature.tone === 'dark'
            ? 'bg-[#09090b] border-white/[0.06] text-base-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_3px_rgba(9,9,11,0.08),0_12px_28px_-6px_rgba(9,9,11,0.12)]'
            : 'bg-white border-base-300 shadow-[0_1px_3px_0_rgba(9,9,11,0.04),0_8px_20px_-4px_rgba(9,9,11,0.06)]'}"
          use:reveal={{ delay: i * 60 }}
        >
          <p
            class="text-xs uppercase tracking-wider font-medium mb-3 {feature.tone ===
            'dark'
              ? 'text-white/50'
              : 'text-neutral'}"
          >
            {feature.category}
          </p>

          {#if feature.name}
            <h3
              class="text-xl font-semibold tracking-tight mb-3 {feature.tone ===
              'dark'
                ? 'text-base-100'
                : 'text-base-content'}"
            >
              {feature.name}
            </h3>
          {/if}

          {#if feature.description}
            <p
              class="text-base leading-relaxed max-w-[45ch] mb-6 {feature.tone ===
              'dark'
                ? 'text-white/70'
                : 'text-neutral'}"
            >
              {feature.description}
            </p>
          {/if}

          <div
            class={feature.visual === "opensource"
              ? "flex-1 flex items-center justify-center"
              : "mt-auto"}
          >
            {#if feature.visual === "search"}
              <div class="grid grid-cols-2 gap-3">
                <div
                  class="rounded-md border border-base-200 border-l-2 border-l-[oklch(62%_0.14_160)] p-4"
                >
                  <p
                    class="text-2xl font-bold text-base-content tabular-nums leading-none"
                  >
                    0.043s
                  </p>
                  <p class="text-[11px] text-neutral/60 mt-2">median query</p>
                </div>
                <div
                  class="rounded-md border border-base-200 border-l-2 border-l-[oklch(62%_0.14_160)] p-4"
                >
                  <p
                    class="text-2xl font-bold text-base-content tabular-nums leading-none"
                  >
                    12M
                  </p>
                  <p class="text-[11px] text-neutral/60 mt-2">rows scanned</p>
                </div>
              </div>
            {:else if feature.visual === "context"}
              <div
                aria-hidden="true"
                class="text-[12px] leading-[1.7] font-mono bg-black/30 rounded-md py-3 border border-white/[0.04]"
              >
                <div class="px-3">
                  <span class="text-[#a1a1aa]">10:31:58</span>
                  <span class="text-blue-400 font-semibold">INFO</span>
                  <span class="text-[#71717a]">api request started</span>
                </div>
                <div class="px-3">
                  <span class="text-[#a1a1aa]">10:32:00</span>
                  <span class="text-amber-400 font-semibold">WARN</span>
                  <span class="text-[#71717a]">api retry attempt 2</span>
                </div>
                <div
                  class="px-3 border-l-2 border-l-red-400 bg-white/5 flex items-center gap-1"
                >
                  <span class="text-red-400 -ml-1">▸</span>
                  <span class="text-[#a1a1aa]">10:32:01</span>
                  <span class="text-red-400 font-semibold">ERROR</span>
                  <span class="text-[#e4e4e7]">api Connection timeout</span>
                </div>
                <div class="px-3">
                  <span class="text-[#a1a1aa]">10:32:03</span>
                  <span class="text-blue-400 font-semibold">INFO</span>
                  <span class="text-[#71717a]">api request failed</span>
                </div>
              </div>
            {:else if feature.visual === "docker"}
              <pre class="text-sm leading-relaxed font-mono"><span
                  class="text-[#71717a]">$</span
                > <span class="text-[#e4e4e7]">docker compose up -d</span>
<span class="text-[#52525b]"
                  >Creating logwiz-quickwit  ... done
Creating logwiz           ... done</span
                >

<span class="text-emerald-400"
                  >✓ Logwiz is running at http://localhost:8282</span
                ></pre>
            {:else if feature.visual === "cost"}
              <div class="grid grid-cols-2 gap-3">
                <div
                  class="rounded-md border border-base-200 p-4 flex flex-col gap-3"
                >
                  <div>
                    <p
                      class="text-[10px] text-neutral/50 uppercase tracking-wider font-medium mb-2"
                    >
                      ES cluster
                    </p>
                    <p
                      class="text-2xl font-bold text-base-content tabular-nums leading-none"
                    >
                      $2,400<span class="text-sm font-medium text-neutral/60"
                        >/mo</span
                      >
                    </p>
                  </div>
                  <div class="h-1 rounded-full bg-base-content/70"></div>
                </div>
                <div
                  class="rounded-md border border-[oklch(62%_0.14_160/0.45)] bg-[oklch(62%_0.14_160/0.08)] p-4 flex flex-col gap-3"
                >
                  <div>
                    <p
                      class="text-[10px] text-neutral/50 uppercase tracking-wider font-medium mb-2"
                    >
                      Logwiz + S3
                    </p>
                    <p
                      class="text-2xl font-bold text-base-content tabular-nums leading-none"
                    >
                      $240<span class="text-sm font-medium text-neutral/60"
                        >/mo</span
                      >
                    </p>
                  </div>
                  <div class="h-1 rounded-full bg-base-200">
                    <div
                      class="h-full rounded-full bg-[oklch(62%_0.14_160)]"
                      style="width: 10%"
                    ></div>
                  </div>
                </div>
              </div>
            {:else if feature.visual === "otel"}
              <div
                class="flex items-center gap-1.5 text-[10px] font-mono w-full"
              >
                <span
                  class="flex-1 text-center whitespace-nowrap border border-base-300 bg-base-100 rounded-full px-2 py-1 text-base-content"
                  >OTLP/HTTP</span
                >
                <span aria-hidden="true" class="text-neutral/40 shrink-0"
                  >→</span
                >
                <span
                  class="flex-1 text-center whitespace-nowrap bg-[oklch(62%_0.14_160)] text-white rounded-full px-2 py-1 font-medium"
                  >Logwiz</span
                >
                <span aria-hidden="true" class="text-neutral/40 shrink-0"
                  >→</span
                >
                <span
                  class="flex-1 text-center whitespace-nowrap border border-base-300 bg-base-100 rounded-full px-2 py-1 text-base-content"
                  >S3 / R2 / MinIO</span
                >
              </div>
            {:else if feature.visual === "opensource"}
              <div class="flex flex-col items-center text-center">
                <p
                  class="text-5xl md:text-6xl font-bold text-[#e4e4e7] tabular-nums leading-none tracking-tight"
                >
                  MIT
                </p>
                <p class="text-[#71717a] text-sm mt-3">
                  free and open source, forever
                </p>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- CTA -->
<section class="py-20 md:py-28 relative">
  <div class="max-w-[1200px] mx-auto px-6">
    <div
      class="relative rounded-2xl border border-base-300 overflow-hidden px-8 md:px-16 py-16 md:py-20"
      style="background: linear-gradient(135deg, oklch(96% 0.018 160) 0%, oklch(98% 0.006 160) 60%, oklch(99% 0 0) 100%);"
      use:reveal
    >
      <div
        class="absolute inset-0 pointer-events-none"
        style="background: radial-gradient(ellipse 60% 70% at 85% 50%, oklch(62% 0.14 160 / 0.05), transparent);"
      ></div>
      <div class="relative">
        <p
          class="text-xs uppercase tracking-wider text-neutral font-medium mb-4"
        >
          — Get started
        </p>
        <h2
          class="text-3xl md:text-5xl font-semibold text-base-content tracking-tight"
          style="text-wrap: balance"
        >
          Ready to simplify your logging?
        </h2>
        <p class="text-lg text-neutral mt-4 max-w-[50ch] leading-relaxed">
          Deploy Logwiz in minutes with Docker.
        </p>

        <div class="mt-8">
          <div
            class="relative bg-[#09090b] border border-white/[0.08] rounded-lg px-4 py-3 shadow-[0_1px_3px_rgba(9,9,11,0.08),0_8px_20px_-6px_rgba(9,9,11,0.15)]"
          >
            <button
              type="button"
              onclick={copyInstallCommand}
              aria-label="Copy install commands"
              aria-live="polite"
              class="absolute top-2 right-2 shrink-0 text-xs font-medium text-white/80 hover:text-white bg-white/[0.08] hover:bg-white/[0.14] rounded-md px-3 py-1.5 transition-colors duration-150 ease-out-custom"
            >
              {copyState === "copied"
                ? "Copied"
                : copyState === "failed"
                  ? "Failed"
                  : "Copy"}
            </button>
            <div
              class="font-mono text-sm text-base-100/90 leading-relaxed overflow-x-auto pr-20 flex flex-col gap-1"
            >
              {#each installCommands as cmd}
                <div class="whitespace-nowrap">
                  <span class="text-[#71717a]">$</span>
                  {cmd}
                </div>
              {/each}
            </div>
          </div>
        </div>

        <div class="mt-8 flex flex-wrap gap-4">
          <a
            href="https://docs.logwiz.io"
            class="bg-base-content text-base-100 px-6 py-2.5 rounded-lg text-sm font-medium btn-lift transition-[transform,box-shadow] duration-200 ease-out-custom"
          >
            Get started
          </a>
          <a
            href="https://github.com/oleksandr-zhyhalo/logwiz"
            class="inline-flex items-center gap-2 border border-base-300 text-base-content px-6 py-2.5 rounded-lg text-sm font-medium btn-lift hover:bg-base-200 transition-[transform,box-shadow,background-color] duration-200 ease-out-custom"
          >
            <svg
              class="w-4 h-4 shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M12 .5C5.73.5.67 5.57.67 11.85c0 5.02 3.24 9.27 7.74 10.77.57.11.78-.25.78-.55 0-.27-.01-1.18-.02-2.14-3.15.69-3.81-1.34-3.81-1.34-.52-1.3-1.27-1.65-1.27-1.65-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.19 1.75 1.19 1.02 1.76 2.68 1.25 3.33.96.1-.74.4-1.25.73-1.54-2.51-.29-5.15-1.26-5.15-5.62 0-1.24.44-2.25 1.17-3.04-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.15 1.16a10.93 10.93 0 0 1 5.74 0c2.18-1.47 3.14-1.16 3.14-1.16.62 1.57.23 2.73.11 3.02.73.79 1.16 1.8 1.16 3.04 0 4.37-2.64 5.33-5.16 5.61.41.35.78 1.05.78 2.12 0 1.53-.01 2.77-.01 3.15 0 .31.21.67.79.55 4.5-1.5 7.73-5.75 7.73-10.77C23.33 5.57 18.27.5 12 .5z"
              />
            </svg>
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  @keyframes fadeSlideIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .highlight-accent {
    background-image: linear-gradient(
      to top,
      oklch(86% 0.06 160 / 0.85) 12%,
      transparent 12%
    );
    background-repeat: no-repeat;
    padding-inline: 0.05em;
  }
</style>
