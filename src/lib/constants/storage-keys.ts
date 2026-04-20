export const storageKeys = {
	selectedIndex: 'logwiz:selectedIndex',
	wrapMode: 'logwiz:wrapMode',
	chartCollapsed: 'logwiz:chartCollapsed',
	autocomplete: 'logwiz:autocomplete',
	openSections: (indexId: string) => `logwiz:openSections:${indexId}`,
	collapsedGroups: (indexId: string) => `logwiz:collapsedGroups:${indexId}`
} as const;
