import React from 'react'

function concat(strings: TemplateStringsArray | string, values: any[]): string {
  if (typeof strings === 'string') return strings
  if (Array.isArray(strings)) return strings.reduce((a, s, i) => a + s + (values[i] ?? ''), '')
  return String(strings)
}

export function t(strings: any, ...values: any[]): string {
  if (strings && typeof strings === 'object' && !Array.isArray(strings) && 'message' in strings) {
    return (strings as { message?: string; id?: string }).message ?? (strings as { id?: string }).id ?? ''
  }
  return concat(strings, values)
}

export function plural(_value: any, options: Record<string, string>): string {
  return options.other ?? ''
}

export function select(_value: any, options: Record<string, string>): string {
  return options.other ?? ''
}

export function selectOrdinal(_value: any, options: Record<string, string>): string {
  return options.other ?? ''
}

export function defineMessage<T>(msg: T): T {
  return msg
}

export const Trans: React.FC<{ id?: string; message?: string; children?: React.ReactNode }> = ({
  children,
  id,
  message,
}) => <>{children ?? message ?? id ?? ''}</>

export const Plural: React.FC<Record<string, any>> = ({ value, other, ...forms }) => (
  <>{forms[value] ?? forms._1 ?? other ?? ''}</>
)
