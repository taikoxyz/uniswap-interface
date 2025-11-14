/**
 * Apollo Client for Taiko-only deployment
 *
 * This is a Taiko-only deployment using Goldsky subgraphs.
 * The AWS backend is not used. This client is a minimal stub to satisfy
 * the ApolloProvider requirement in the app, but all real queries should
 * use the Taiko-specific clients from graphql/taiko/apollo.ts
 */

import { ApolloClient, InMemoryCache } from '@apollo/client'
import { Reference, relayStylePagination } from '@apollo/client/utilities'

// Import the Taiko token client as the default Apollo client
import { taikoTokenClient } from 'graphql/taiko/apollo'

/**
 * Export the Taiko token client as the default Apollo client for the app.
 * This provides GraphQL capabilities without requiring AWS infrastructure.
 */
export const apolloClient = taikoTokenClient
