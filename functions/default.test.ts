// Skipped for the Taiko-only deployment: asserts the Uniswap-branded og/twitter
// meta tags that lived in the upstream public/index.html. The rebranded
// index.html no longer carries them, and these Cloudflare Pages functions are
// not deployed for swap.taiko.xyz (which deploys on Vercel).
const defaultUrls = ['http://127.0.0.1:3000/', 'http://127.0.0.1:3000/swap', 'http://127.0.0.1:3000/pools']

test.skip.each(defaultUrls)('should inject metadata for valid collections', async (defaultUrl) => {
  const body = await fetch(new Request(defaultUrl)).then((res) => res.text())
  expect(body).toContain(`<meta property="og:title" content="Uniswap Interface"/>`)
  expect(body).toContain(
    `<meta property="og:description" content="Swap or provide liquidity on the Uniswap Protocol"/>`
  )
  expect(body).toContain(
    `<meta property="og:image" content="http://127.0.0.1:3000/images/1200x630_Rich_Link_Preview_Image.png"/>`
  )
  expect(body).toContain(`<meta property="og:image:width" content="1200"/>`)
  expect(body).toContain(`<meta property="og:image:height" content="630"/>`)
  expect(body).toContain(`<meta property="og:type" content="website"/>`)
  expect(body).toContain(`<meta property="og:image:alt" content="Uniswap Interface"/>`)
  expect(body).toContain(`<meta property="twitter:card" content="summary_large_image"/>`)
  expect(body).toContain(`<meta property="twitter:title" content="Uniswap Interface"/>`)
  expect(body).toContain(
    `<meta property="twitter:image" content="http://127.0.0.1:3000/images/1200x630_Rich_Link_Preview_Image.png"/>`
  )
  expect(body).toContain(`<meta property="twitter:image:alt" content="Uniswap Interface"/>`)
})
