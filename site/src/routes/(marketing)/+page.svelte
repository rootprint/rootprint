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

  onMount(() => {
    const interval = setInterval(() => {
      phraseIndex = (phraseIndex + 1) % phrases.length
    }, 1800)
    return () => clearInterval(interval)
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

  const features = [
    {
      name: "Fast search",
      category: "Performance",
      description:
        "Full-text search powered by Quickwit. Sub-second queries across millions of log entries stored directly on object storage.",
      visual: "search",
    },
    {
      name: "Self-hosted",
      category: "Infrastructure",
      description:
        "Run on your own infrastructure. Your data never leaves your network. Deploy with a single Docker Compose command.",
      visual: "docker",
    },
    {
      name: "Cost effective",
      category: "Cost",
      description:
        "Store logs directly on S3 or compatible object storage. Dramatically lower costs compared to Elasticsearch-based tools.",
      visual: "cost",
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

<!-- Hero -->
<section class="relative overflow-hidden">
  <div
    class="absolute inset-0 pointer-events-none"
    style="background-image: radial-gradient(circle, oklch(14% 0 0 / 0.06) 1px, transparent 1px); background-size: 24px 24px;"
  ></div>
  <div
    class="absolute inset-0 pointer-events-none"
    style="background: radial-gradient(ellipse 80% 70% at 10% 60%, oklch(62% 0.14 160 / 0.07), transparent);"
  ></div>
  <div class="max-w-[1200px] mx-auto px-6 pt-20 pb-0 w-full relative z-[2]">
    <!-- Centered text content -->
    <div class="text-center max-w-[720px] mx-auto">
      <p
        class="text-xs uppercase tracking-wider text-neutral font-medium mb-6"
        use:reveal={{ delay: 0 }}
      >
        Open-source log management
      </p>
      <h1
        class="text-4xl md:text-6xl font-bold text-base-content leading-none tracking-tighter"
        style="text-wrap: balance"
        use:reveal={{ delay: 80 }}
      >
        Search your logs directly on cloud storage
      </h1>
      <p
        class="text-lg text-neutral mt-6 max-w-[50ch] mx-auto leading-relaxed"
        use:reveal={{ delay: 160 }}
      >
        A fast, self-hosted log management platform.
      </p>
      <p class="mt-3 h-8 overflow-hidden relative" use:reveal={{ delay: 200 }}>
        {#key phraseIndex}
          <span
            class="absolute inset-0 inline-flex items-center justify-center text-lg font-medium text-base-content"
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
          class="border border-base-300 text-base-content px-6 py-2.5 rounded-lg text-sm font-medium btn-lift hover:bg-base-200 transition-[transform,box-shadow,background-color] duration-200 ease-out-custom"
        >
          View on GitHub
        </a>
      </div>
      <p
        class="mt-6 text-sm text-neutral flex flex-wrap items-center justify-center gap-2"
        use:reveal={{ delay: 360 }}
      >
        <span class="font-medium">Perfect for:</span>
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
<section class="py-24">
  <div class="max-w-[1200px] mx-auto px-6">
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

    <!-- Tab content -->
    <div class="pt-14 pb-4">
      {#key activeTab}
        <div
          id={capabilityPanelId(activeTab)}
          role="tabpanel"
          aria-labelledby={capabilityTabId(activeTab)}
          tabindex="0"
          class="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-12 items-start animate-[fadeSlideIn_400ms_cubic-bezier(0.16,1,0.3,1)]"
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
            class="bg-white rounded-xl overflow-hidden border border-base-300 shadow-[0_1px_3px_0_rgba(9,9,11,0.04),0_8px_20px_-4px_rgba(9,9,11,0.06)] text-sm"
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
                  <div>
                    <p class="text-base-content font-medium mb-1">service</p>
                    <div class="space-y-1 text-base-content/70">
                      <div class="flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          class="inline-flex h-2.5 w-2.5 items-center justify-center rounded-[2px] border border-base-content bg-base-content text-[7px] text-base-100"
                          >✓</span
                        >
                        <span>api</span>
                      </div>
                      <div class="flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          class="h-2.5 w-2.5 rounded-[2px] border border-base-content/30 bg-white"
                        ></span>
                        <span>auth</span>
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
                      <span class="text-neutral/40 w-16 shrink-0">10:32:01</span
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
                      <span class="text-neutral/40 w-16 shrink-0">10:32:00</span
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
                      <span class="text-neutral/40 w-16 shrink-0">10:31:58</span
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
                      <span class="text-neutral/40 w-16 shrink-0">10:31:57</span
                      ><span class="text-neutral/30">|</span><span
                        class="text-base-content/60 w-14 shrink-0">auth</span
                      ><span class="text-neutral/30">|</span><span
                        class="text-base-content/80 truncate"
                        >Retry attempt 3/5</span
                      >
                    </div>
                    <div
                      class="flex gap-2 py-[5px] border-l-[3px] border-l-[#3b82f6] pl-2 hover:bg-base-100 transition-[background-color] duration-150 ease-out-custom"
                    >
                      <span class="text-neutral/40 w-16 shrink-0">10:31:55</span
                      ><span class="text-neutral/30">|</span><span
                        class="text-base-content/60 w-14 shrink-0">api</span
                      ><span class="text-neutral/30">|</span><span
                        class="text-base-content/80 truncate"
                        >Health check passed</span
                      >
                    </div>
                  </div>
                  <p class="text-neutral/40 text-[10px] mt-2 font-mono">
                    1,247 results in 0.043s
                  </p>
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
                  OTLP endpoint · also <span class="font-mono"
                    >/api/ingest/&#123;indexId&#125;</span
                  > for NDJSON
                </p>
                <!-- Language pills -->
                <p
                  class="text-[10px] text-neutral/50 uppercase tracking-wider font-medium mb-2"
                >
                  Drop-in OTEL SDKs
                </p>
                <div class="flex flex-wrap gap-1.5 mb-4">
                  {#each ["Python", "Node.js", "Go", "Java", ".NET", "Docker"] as lang (lang)}
                    <span
                      class="text-[11px] bg-base-100 border border-base-300 rounded-full px-2.5 py-0.5 text-base-content"
                      >{lang}</span
                    >
                  {/each}
                </div>
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
                <div class="mt-5 pt-4 border-t border-base-200">
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
                      <span class="text-neutral/40 font-mono">lwit_a7f3...</span
                      >
                      <span class="text-neutral/30 ml-auto"
                        >Last used 2m ago</span
                      >
                    </div>
                    <div class="flex items-center gap-3 py-2">
                      <span class="text-base-content font-medium">staging</span>
                      <span class="text-neutral/40 font-mono">lwit_9bk2...</span
                      >
                      <span class="text-neutral/30 ml-auto"
                        >Last used 1h ago</span
                      >
                    </div>
                    <div class="flex items-center gap-3 py-2">
                      <span
                        class="text-base-content/40 font-medium line-through"
                        >legacy-v1</span
                      >
                      <span class="text-neutral/30 font-mono">lwit_x2m1...</span
                      >
                      <span class="text-red-400/60 ml-auto">Revoked</span>
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
                  <div class="flex items-center justify-between text-xs mb-1.5">
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
                    <p class="text-[10px] text-neutral/40">2.4 MB compressed</p>
                  </div>
                  <span class="text-xs text-primary font-medium shrink-0"
                    >Download</span
                  >
                </div>
              </div>
            {:else if capabilities[activeTab].visual === "users"}
              <!-- Admin tabs -->
              <div class="flex gap-0 border-b border-base-200 px-5 pt-3">
                <span
                  class="text-xs font-medium text-base-content border-b-2 border-base-content px-3 pb-2"
                  >Users</span
                >
                <span class="text-xs text-neutral/50 px-3 pb-2">Indexes</span>
                <span class="text-xs text-neutral/50 px-3 pb-2">Send Logs</span>
              </div>
              <div class="p-5">
                <div class="flex items-center justify-between mb-4">
                  <div>
                    <p class="text-base-content text-sm font-medium">Users</p>
                    <p class="text-[11px] text-neutral/40">
                      Manage your Logwiz instance
                    </p>
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
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/key}
    </div>
  </div>
</section>

<!-- Features Zig-Zag -->
<section class="bg-base-200 py-20 relative overflow-hidden">
  <div
    class="absolute inset-0 pointer-events-none"
    style="background-image: radial-gradient(circle, oklch(14% 0 0 / 0.04) 1px, transparent 1px); background-size: 24px 24px;"
  ></div>
  <div class="max-w-[1200px] mx-auto px-6 relative">
    <h2
      class="text-3xl md:text-5xl font-semibold text-base-content mb-14 tracking-tight"
      style="text-wrap: balance"
      use:reveal
    >
      Built for developers
    </h2>

    <div class="flex flex-col gap-16">
      {#each features as feature, i}
        <div
          class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center {i % 2 ===
          1
            ? 'md:[direction:rtl]'
            : ''}"
          use:reveal={{ delay: i * 80 }}
        >
          <div class={i % 2 === 1 ? "md:[direction:ltr]" : ""}>
            <p
              class="text-xs uppercase tracking-wider text-neutral font-medium mb-2"
            >
              {feature.category}
            </p>
            <h3
              class="text-xl font-semibold text-base-content tracking-tight mb-3"
            >
              {feature.name}
            </h3>
            <p class="text-base text-neutral leading-relaxed max-w-[45ch]">
              {feature.description}
            </p>
          </div>

          <div
            class="feature-card bg-[#09090b] rounded-xl overflow-hidden border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_3px_rgba(9,9,11,0.08),0_12px_28px_-6px_rgba(9,9,11,0.12)] p-6 flex items-center justify-center min-h-[180px] transition-[border-color,box-shadow] duration-200 ease-out-custom {i %
              2 ===
            1
              ? 'md:[direction:ltr]'
              : ''}"
          >
            {#if feature.visual === "search"}
              <pre class="text-sm leading-relaxed"><span class="text-[#71717a]"
                  >$</span
                > <span class="text-[#e4e4e7]"
                  >query: level:error AND service:api</span
                >
<span class="text-[#52525b]">Found 1,247 results in 0.043s</span>

<span class="text-[#a1a1aa]">2026-04-14 10:32:01</span> <span
                  class="text-red-400 font-semibold">ERROR</span
                > <span class="text-[#71717a]"
                  >Connection timeout after 30s</span
                >
<span class="text-[#a1a1aa]">2026-04-14 10:32:00</span> <span
                  class="text-red-400 font-semibold">ERROR</span
                > <span class="text-[#71717a]">Failed to process request</span>
<span class="text-[#a1a1aa]">2026-04-14 10:31:58</span> <span
                  class="text-red-400 font-semibold">ERROR</span
                > <span class="text-[#71717a]">Database connection refused</span
                ></pre>
            {:else if feature.visual === "docker"}
              <pre class="text-sm leading-relaxed"><span class="text-[#71717a]"
                  >$</span
                > <span class="text-[#e4e4e7]">docker compose up -d</span>
<span class="text-[#52525b]"
                  >Creating logwiz ... done
Creating quickwit ... done</span
                >

<span class="text-green-400">Logwiz is running at http://localhost:8282</span
                ></pre>
            {:else if feature.visual === "cost"}
              <div class="text-center">
                <p class="text-4xl font-bold text-[#e4e4e7] tabular-nums">
                  ~10x
                </p>
                <p class="text-[#52525b] text-sm mt-2">
                  cheaper than Elasticsearch
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
<section class="py-28 relative overflow-hidden" use:reveal>
  <div
    class="absolute inset-0 pointer-events-none"
    style="background: radial-gradient(ellipse 60% 70% at 85% 50%, oklch(62% 0.14 160 / 0.05), transparent);"
  ></div>
  <div class="max-w-[1200px] mx-auto px-6 relative">
    <p class="text-xs uppercase tracking-wider text-neutral font-medium mb-4">
      Get started
    </p>
    <h2
      class="text-3xl md:text-5xl font-semibold text-base-content tracking-tight"
      style="text-wrap: balance"
    >
      Ready to simplify your logging?
    </h2>
    <p class="text-lg text-neutral mt-4 max-w-[50ch] leading-relaxed">
      Deploy Logwiz in minutes with Docker. Free and open source, forever.
    </p>
    <div class="mt-10 flex flex-wrap gap-4">
      <a
        href="https://docs.logwiz.io"
        class="bg-base-content text-base-100 px-6 py-2.5 rounded-lg text-sm font-medium btn-lift transition-[transform,box-shadow] duration-200 ease-out-custom"
      >
        Get started
      </a>
      <a
        href="https://github.com/oleksandr-zhyhalo/logwiz"
        class="border border-base-300 text-base-content px-6 py-2.5 rounded-lg text-sm font-medium btn-lift hover:bg-base-200 transition-[transform,box-shadow,background-color] duration-200 ease-out-custom"
      >
        View on GitHub
      </a>
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
</style>
