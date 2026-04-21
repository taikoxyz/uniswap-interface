import React from 'react'

function concat(strings: TemplateStringsArray | string, values: any[]): string {
  if (typeof strings === 'string') return strings
  if (Array.isArray(strings)) return strings.reduce((a, s, i) => a + s + (values[i] ?? ''), '')
  return String(strings)
}

export function t(...args: any[]): any {
  // Curry form t(i18n)`...`: first call passes an i18n instance (opaque object
  // without `message`/template-strings shape); return a tagged-template fn.
  if (
    args.length === 1 &&
    args[0] &&
    typeof args[0] === 'object' &&
    !Array.isArray(args[0]) &&
    !('message' in args[0])
  ) {
    return (strings: any, ...vs: any[]) => concat(strings, vs)
  }
  const [strings, ...values] = args
  if (strings && typeof strings === 'object' && !Array.isArray(strings) && 'message' in strings) {
    return (strings as { message?: string; id?: string }).message ?? (strings as { id?: string }).id ?? ''
  }
  return concat(strings, values)
}

export function plural(value: any, options: Record<string, string>): string {
  if (Number(value) === 1 && options.one != null) return options.one
  if (options[String(value)] != null) return options[String(value)]
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

export const Plural: React.FC<Record<string, any>> = ({ value, other, one, ...forms }) => {
  const n = Number(value)
  const pick = n === 1 && one != null ? one : forms[String(value)] ?? other ?? ''
  return <>{pick}</>
}
