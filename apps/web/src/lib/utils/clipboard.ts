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
	const host = [...document.querySelectorAll('dialog[open]')].pop() ?? document.body;
	const ta = document.createElement('textarea');
	ta.value = text;
	ta.setAttribute('readonly', '');
	ta.style.position = 'fixed';
	ta.style.opacity = '0';
	host.appendChild(ta);
	ta.focus();
	ta.select();
	try {
		return document.execCommand('copy');
	} catch {
		return false;
	} finally {
		ta.remove();
	}
}

export async function copyWithToast(
	text: string,
	successMessage: string,
	errorMessage = 'Failed to copy'
): Promise<void> {
	const ok = await copyToClipboard(text);
	if (ok) toast.success(successMessage);
	else toast.error(errorMessage);
}
