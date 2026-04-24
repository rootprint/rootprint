<svelte:head>
  <title>Privacy — Logwiz</title>
  <meta
    name="description"
    content="How we handle data on logwiz.io. Short version: cookieless analytics via Umami, nothing else."
  />
</svelte:head>

<article class="max-w-[1200px] mx-auto px-6 py-16">
  <div class="max-w-[65ch] mx-auto">
    <h1
      class="text-3xl sm:text-4xl font-semibold text-base-content tracking-tight"
    >
      Privacy
    </h1>

    <p class="mt-6 text-base text-neutral leading-relaxed">
      This site uses <a
        href="https://umami.is/"
        target="_blank"
        rel="noopener noreferrer"
        class="underline decoration-neutral/40 underline-offset-2 hover:decoration-base-content hover:text-base-content transition-colors duration-200 ease-out-custom"
        >Umami</a
      >, a privacy-friendly, open-source analytics tool. We use it to understand
      which pages are popular and where visitors come from — nothing more.
    </p>

    <h2 class="mt-10 text-xl font-semibold text-base-content tracking-tight">
      What's collected
    </h2>
    <ul
      class="mt-4 space-y-2 text-base text-neutral leading-relaxed list-disc pl-6"
    >
      <li>Page URL you visited</li>
      <li>Referring page (e.g. a search engine or link)</li>
      <li>Browser type and version</li>
      <li>Operating system</li>
      <li>Device type (desktop / mobile / tablet)</li>
      <li>
        Country, derived from your IP address (the IP itself is not stored)
      </li>
      <li>Browser language</li>
    </ul>
    <p class="mt-4 text-base text-neutral leading-relaxed">
      All of this is aggregated and anonymous. There is no way to identify an
      individual visitor from this data.
    </p>

    <h2 class="mt-10 text-xl font-semibold text-base-content tracking-tight">
      What's not collected
    </h2>
    <ul
      class="mt-4 space-y-2 text-base text-neutral leading-relaxed list-disc pl-6"
    >
      <li>
        <strong class="text-base-content font-semibold">No cookies.</strong> Umami
        is cookieless.
      </li>
      <li>
        <strong class="text-base-content font-semibold">No personal data.</strong>
        No IP addresses, names, emails, or identifiers that persist across visits.
      </li>
      <li>
        <strong class="text-base-content font-semibold"
          >No cross-site tracking.</strong
        > Your activity on other sites is not linked to activity here.
      </li>
    </ul>

    <h2 class="mt-10 text-xl font-semibold text-base-content tracking-tight">
      Where it's stored
    </h2>
    <p class="mt-4 text-base text-neutral leading-relaxed">
      Analytics data is stored on Umami Cloud (<a
        href="https://umami.is/"
        target="_blank"
        rel="noopener noreferrer"
        class="underline decoration-neutral/40 underline-offset-2 hover:decoration-base-content hover:text-base-content transition-colors duration-200 ease-out-custom"
        >umami.is</a
      >), operated by Umami Software, Inc.
    </p>

    <h2 class="mt-10 text-xl font-semibold text-base-content tracking-tight">
      The rest of Logwiz
    </h2>
    <p class="mt-4 text-base text-neutral leading-relaxed">
      Logwiz is self-hosted software you run on your own infrastructure. When
      you install and use Logwiz, no data from your installation flows back to
      us. Everything stays on your servers.
    </p>

    <h2 class="mt-10 text-xl font-semibold text-base-content tracking-tight">Contact</h2>
    <p class="mt-4 text-base text-neutral leading-relaxed">
      Questions? <a
        href="https://github.com/oleksandr-zhyhalo/logwiz/issues"
        target="_blank"
        rel="noopener noreferrer"
        class="underline decoration-neutral/40 underline-offset-2 hover:decoration-base-content hover:text-base-content transition-colors duration-200 ease-out-custom"
        >Open an issue on GitHub</a
      >.
    </p>

    <p class="mt-12 text-sm text-neutral/70">Last updated: 2026-04-24</p>
  </div>
</article>
