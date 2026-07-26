// Type-only augmentation of @uniswap/v3-sdk's FeeAmount enum.
//
// The pinned @uniswap/v3-sdk 3.10.0 only declares LOWEST/LOW/MEDIUM/HIGH, but parts of the
// interface (ported from newer upstream code) reference the LOW_200/LOW_300/LOW_400 tiers that
// were added in later sdk versions. These members are TYPE-ONLY: the runtime enum object in
// v3-sdk 3.10.0 does not contain them, so `FeeAmount.LOW_200` etc. still evaluate to `undefined`
// at runtime (the app compiles with babel, which strips types). That matches current production
// behavior and is acceptable because the 200/300/400 bps tiers are not enabled on Taiko's factory.
import '@uniswap/v3-sdk'

declare module '@uniswap/v3-sdk' {
  export enum FeeAmount {
    LOW_200 = 200,
    LOW_300 = 300,
    LOW_400 = 400,
  }
}
