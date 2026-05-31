import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

export type WithoutChildren<T> = Omit<T, 'children'>;

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
