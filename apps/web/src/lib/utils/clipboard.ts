import { toast } from 'svelte-sonner';

export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy path
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(ta);
  }
}

export async function copyWithToast(
  text: string,
  successMessage: string,
  errorMessage = 'Failed to copy',
): Promise<void> {
  const ok = await copyToClipboard(text);
  if (ok) toast.success(successMessage);
  else toast.error(errorMessage);
}
