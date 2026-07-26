import Modal from '../Modal'
import TokenSafety, { TokenSafetyProps } from '.'

interface TokenSafetyModalProps extends TokenSafetyProps {
  isOpen: boolean
}

// eslint-disable-next-line import/no-unused-modules -- used by commented-out token-safety UI in pages/Swap and Tokens/TokenDetails, kept for re-enablement
export default function TokenSafetyModal({
  isOpen,
  tokenAddress,
  secondTokenAddress,
  onContinue,
  onCancel,
  onBlocked,
  showCancel,
}: TokenSafetyModalProps) {
  return (
    <Modal isOpen={isOpen} onDismiss={onCancel}>
      <TokenSafety
        tokenAddress={tokenAddress}
        secondTokenAddress={secondTokenAddress}
        onContinue={onContinue}
        onBlocked={onBlocked}
        onCancel={onCancel}
        showCancel={showCancel}
      />
    </Modal>
  )
}
