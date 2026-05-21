export const OTEL_ATTR_PREFIX = 'attributes.';
export const OTEL_RESOURCE_ATTR_PREFIX = 'resource_attributes.';

export function isOtelAttr(name: string): boolean {
  return name.startsWith(OTEL_ATTR_PREFIX);
}

export function isOtelResourceAttr(name: string): boolean {
  return name.startsWith(OTEL_RESOURCE_ATTR_PREFIX);
}
