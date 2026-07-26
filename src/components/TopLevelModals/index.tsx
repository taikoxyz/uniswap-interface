import { OffchainActivityModal } from 'components/AccountDrawer/MiniPortfolio/Activity/OffchainActivityModal'
import UniwalletModal from 'components/AccountDrawer/UniwalletModal'
import AirdropModal from 'components/AirdropModal'
import BaseAnnouncementBanner from 'components/Banner/BaseAnnouncementBanner'
import AddressClaimModal from 'components/claim/AddressClaimModal'
import Bag from 'nft/components/bag/Bag'
import TransactionCompleteModal from 'nft/components/collection/TransactionCompleteModal'
import { useModalIsOpen, useToggleModal } from 'state/application/hooks'
import { ApplicationModal } from 'state/application/reducer'

export default function TopLevelModals() {
  const addressClaimOpen = useModalIsOpen(ApplicationModal.ADDRESS_CLAIM)
  const addressClaimToggle = useToggleModal(ApplicationModal.ADDRESS_CLAIM)

  return (
    <>
      <AddressClaimModal isOpen={addressClaimOpen} onDismiss={addressClaimToggle} />
      <Bag />
      <UniwalletModal />
      <BaseAnnouncementBanner />
      <OffchainActivityModal />
      <TransactionCompleteModal />
      <AirdropModal />
    </>
  )
}
