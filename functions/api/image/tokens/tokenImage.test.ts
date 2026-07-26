const tokenImageUrl = [
  'http://127.0.0.1:3000/api/image/tokens/ethereum/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  'http://127.0.0.1:3000/api/image/tokens/ethereum/NATIVE',
]

// Skipped for the Taiko-only deployment: og-image generation resolves token
// data through Uniswap's private GraphQL gateway (api.uniswap.org), which does
// not serve this fork, and these Cloudflare Pages functions are not deployed
// for swap.taiko.xyz (which deploys on Vercel). The invalid-route test below
// stays active because it asserts 404s without any external data.
test.skip.each(tokenImageUrl)('tokenImageUrl', async (url) => {
  const response = await fetch(new Request(url))
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toBe('image/png')
})

const invalidTokenImageUrl = [
  'http://127.0.0.1:3000/api/image/tokens/ethereum/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb49',
  'http://127.0.0.1:3000/api/image/tokens/ethereum',
  'http://127.0.0.1:3000/api/image/tokens/ethereun',
  'http://127.0.0.1:3000/api/image/tokens/potato/?potato=1',
]

test.each(invalidTokenImageUrl)('invalidAssetImageUrl', async (url) => {
  const response = await fetch(new Request(url))
  expect(response.status).toBe(404)
})
