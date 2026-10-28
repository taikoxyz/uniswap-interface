import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { createServer, IncomingMessage, Server, ServerResponse } from 'http'
import { AddressInfo } from 'net'

import {
  AppJsonRpcProvider,
  getRetryAfterMs,
  getRpcConnection,
  isDeterministicExecutionError,
  sendWithRateLimitRetry,
} from './providers'

const ZK_GAS_ERROR_BODY = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  error: { code: -32005, message: 'Revm error: zk gas limit exceeded' },
})

const CALL = [{ to: '0x0000000000000000000000000000000000000001' }, 'latest']

type Respond = (res: ServerResponse) => void

/** Local JSON-RPC stand-in that scripts one response per eth_call and answers everything else (eg block polling). */
async function startServer(responses: Respond[]) {
  const state = { ethCalls: 0 }
  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      const { id, method } = JSON.parse(raw)
      if (method !== 'eth_call') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', id, result: '0x1' }))
        return
      }
      const respond = responses[Math.min(state.ethCalls, responses.length - 1)]
      state.ethCalls += 1
      respond(res)
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const close = () => new Promise<void>((resolve) => server.close(() => resolve()))
  return { url, state, close }
}

const zkGasLimit: Respond = (res) => {
  // Mimics eRPC on rpc.mainnet.taiko.xyz, which maps the node's -32005 execution error to HTTP 429.
  res.writeHead(429, { 'content-type': 'application/json' })
  res.end(ZK_GAS_ERROR_BODY)
}
const rateLimited: Respond = (res) => {
  res.writeHead(429, { 'content-type': 'text/plain' })
  res.end('Too Many Requests')
}
const ok =
  (result: string): Respond =>
  (res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result }))
  }

describe('getRpcConnection', () => {
  it('keeps the url', () => {
    expect(getRpcConnection('https://rpc.example')).toEqual(expect.objectContaining({ url: 'https://rpc.example' }))
  })

  it('does not stall-and-retry when the RPC answers 429 with a zk gas limit error', async () => {
    const { url, state, close } = await startServer([zkGasLimit])
    const provider = new StaticJsonRpcProvider(getRpcConnection(url), { chainId: 167000, name: 'taiko' })

    await expect(provider.send('eth_call', CALL)).rejects.toThrow(/zk gas limit exceeded/)
    expect(state.ethCalls).toBe(1)
    await close()
  })
})

describe('sendWithRateLimitRetry', () => {
  const rateLimitError = Object.assign(new Error('Too Many Requests'), { status: 429, body: 'rate limited' })
  const zkGasError = Object.assign(new Error('processing response error'), { status: 429, body: ZK_GAS_ERROR_BODY })

  it('retries a genuine 429 until it succeeds', async () => {
    const send = jest.fn().mockRejectedValueOnce(rateLimitError).mockResolvedValue('ok')
    await expect(sendWithRateLimitRetry(send, { baseDelayMs: 1 })).resolves.toBe('ok')
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('gives up after the bounded number of retries', async () => {
    const send = jest.fn().mockRejectedValue(rateLimitError)
    await expect(sendWithRateLimitRetry(send, { retries: 2, baseDelayMs: 1 })).rejects.toBe(rateLimitError)
    expect(send).toHaveBeenCalledTimes(3)
  })

  it('does not retry a 429 carrying a zk gas limit error', async () => {
    const send = jest.fn().mockRejectedValue(zkGasError)
    await expect(sendWithRateLimitRetry(send, { baseDelayMs: 1 })).rejects.toBe(zkGasError)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('does not retry non-429 errors', async () => {
    const send = jest.fn().mockRejectedValue(new Error('boom'))
    await expect(sendWithRateLimitRetry(send, { baseDelayMs: 1 })).rejects.toThrow('boom')
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('retries a genuine -32005 rate limit, which is not an execution failure', async () => {
    const limited = Object.assign(new Error('rate limit exceeded'), {
      status: 429,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32005, message: 'rate limit exceeded' } }),
    })
    const send = jest.fn().mockRejectedValueOnce(limited).mockResolvedValue('ok')
    await expect(sendWithRateLimitRetry(send, { baseDelayMs: 1 })).resolves.toBe('ok')
    expect(send).toHaveBeenCalledTimes(2)
    expect(isDeterministicExecutionError(limited)).toBe(false)
  })

  it('waits at least Retry-After before retrying, capped', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined)
    const cooldown = Object.assign(new Error('Too Many Requests'), { status: 429, headers: { 'retry-after': '3' } })
    const send = jest.fn().mockRejectedValueOnce(cooldown).mockResolvedValue('ok')
    await expect(sendWithRateLimitRetry(send, { baseDelayMs: 1, sleep })).resolves.toBe('ok')
    expect(sleep).toHaveBeenCalledWith(3000)

    const long = Object.assign(new Error('Too Many Requests'), { status: 429, headers: { 'Retry-After': '600' } })
    const sleepLong = jest.fn().mockResolvedValue(undefined)
    await sendWithRateLimitRetry(jest.fn().mockRejectedValueOnce(long).mockResolvedValue('ok'), {
      baseDelayMs: 1,
      sleep: sleepLong,
    })
    expect(sleepLong).toHaveBeenCalledWith(5000)
  })

  it('parses Retry-After as seconds or an HTTP date', () => {
    expect(getRetryAfterMs({ headers: { 'retry-after': '2' } })).toBe(2000)
    expect(
      getRetryAfterMs(
        { headers: { 'Retry-After': 'Wed, 21 Oct 2026 07:28:05 GMT' } },
        Date.parse('Wed, 21 Oct 2026 07:28:00 GMT')
      )
    ).toBe(5000)
    expect(getRetryAfterMs({ headers: {} })).toBeUndefined()
    expect(getRetryAfterMs(new Error('x'))).toBeUndefined()
  })

  it('recognises deterministic execution errors', () => {
    expect(isDeterministicExecutionError(zkGasError)).toBe(true)
    expect(isDeterministicExecutionError(rateLimitError)).toBe(false)
    expect(isDeterministicExecutionError(undefined)).toBe(false)
  })
})

describe('AppJsonRpcProvider', () => {
  it('recovers from a transient genuine 429 within a single call', async () => {
    const { url, state, close } = await startServer([rateLimited, ok('0x02')])
    const provider = new AppJsonRpcProvider(167000 as never, url)

    await expect(provider.send('eth_call', CALL)).resolves.toBe('0x02')
    expect(state.ethCalls).toBe(2)
    provider.removeAllListeners()
    await close()
  })

  it('fails fast on a zk gas limit error and does not replay the failure from the block cache', async () => {
    const { url, state, close } = await startServer([zkGasLimit, ok('0x01')])
    const provider = new AppJsonRpcProvider(167000 as never, url)

    await expect(provider.send('eth_call', CALL)).rejects.toThrow(/zk gas limit exceeded/)
    expect(state.ethCalls).toBe(1)
    // The router's own retry within the same block must reach the RPC again rather than get the cached rejection.
    await expect(provider.send('eth_call', CALL)).resolves.toBe('0x01')
    expect(state.ethCalls).toBe(2)
    provider.removeAllListeners()
    await close()
  })
})
