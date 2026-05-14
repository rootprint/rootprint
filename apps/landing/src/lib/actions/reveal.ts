export function reveal(node: HTMLElement, options?: { delay?: number }) {
  const delay = options?.delay ?? 0

  node.style.opacity = "0"
  node.style.transform = "translateY(16px)"
  node.style.transition = `opacity 500ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 500ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          node.style.opacity = "1"
          node.style.transform = "translateY(0)"
          observer.unobserve(node)
        }
      }
    },
    { threshold: 0.15 },
  )

  observer.observe(node)

  return {
    destroy() {
      observer.unobserve(node)
    },
  }
}
