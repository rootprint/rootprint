<script>
  import "../app.css"
  import { page } from "$app/stores"
</script>

<div class="min-h-[100dvh] flex items-center justify-center px-6">
  <div class="text-center max-w-md">
    <p class="text-8xl font-bold text-base-300 tabular-nums">
      {$page?.status ?? "?"}
    </p>
    <h1 class="text-2xl font-semibold text-base-content mt-6">
      {#if $page?.status === 404}
        Page not found
      {:else}
        Something went wrong
      {/if}
    </h1>
    <p class="text-neutral mt-3 leading-relaxed">
      {$page?.error?.message ?? "An unexpected error occurred."}
    </p>
    <a
      href="/"
      class="inline-block bg-base-content text-base-100 px-6 py-2.5 rounded-lg text-sm font-medium btn-lift transition-[transform,box-shadow] duration-200 ease-out-custom mt-8"
    >
      Return home
    </a>
  </div>
</div>
