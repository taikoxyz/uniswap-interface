import { TAIKO_HOODI_CHAIN_ID, TAIKO_MAINNET_CHAIN_ID } from 'config/chains'

/**
 * Fallback JSON-RPC endpoints.
 * These are used if the integrator does not provide an endpoint, or if the endpoint does not work.
 *
 * MetaMask allows switching to any URL, but displays a warning if it is not on the "Safe" list:
 * https://github.com/MetaMask/metamask-mobile/blob/bdb7f37c90e4fc923881a07fca38d4e77c73a579/app/core/RPCMethods/wallet_addEthereumChain.js#L228-L235
 * https://chainid.network/chains.json
 *
 * These "Safe" URLs are listed first, followed by other fallback URLs, which are taken from chainlist.org.
 */
export const FALLBACK_URLS = {
  [TAIKO_MAINNET_CHAIN_ID]: [
    // "Safe" URLs
    'https://rpc.mainnet.taiko.xyz',
  ],
  [TAIKO_HOODI_CHAIN_ID]: [
    // "Safe" URLs
    'https://rpc.hoodi.taiko.xyz',
  ],
}

/**
 * Known JSON-RPC endpoints.
 * These are the URLs used by the interface when there is not another available source of chain data.
 */
export const RPC_URLS = {
  [TAIKO_MAINNET_CHAIN_ID]: FALLBACK_URLS[TAIKO_MAINNET_CHAIN_ID],
  [TAIKO_HOODI_CHAIN_ID]: FALLBACK_URLS[TAIKO_HOODI_CHAIN_ID],
}
