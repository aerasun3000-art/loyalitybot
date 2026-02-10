import React from 'react'
import { QrCode, UserPlus } from 'lucide-react'

/**
 * Две главные кнопки под карточкой баланса (neo design).
 * Макет: фиолетовая «Scan QR», тёмная «Invite», active:scale-95.
 */
const QuickActions = ({ onScanQr, onInvite, scanLabel = 'Scan QR', inviteLabel = 'Invite', loading = false }) => (
  <div className="flex gap-3">
    <button
      type="button"
      onClick={onScanQr}
      disabled={loading}
      className="flex-1 active:scale-95 transition-all py-4 rounded-2xl flex items-center justify-center gap-2 font-bold disabled:opacity-60"
      style={{
        backgroundColor: 'var(--tg-theme-button-color, #8B5CF6)',
        color: 'var(--tg-theme-button-text-color, #fff)',
        boxShadow: '0 4px 12px color-mix(in srgb, var(--tg-theme-button-color, #8B5CF6) 30%, transparent)',
      }}
    >
      <QrCode size={20} />
      <span>{loading ? '...' : scanLabel}</span>
    </button>

    <button
      type="button"
      onClick={onInvite}
      className="flex-1 active:scale-95 transition-all py-4 rounded-2xl flex items-center justify-center gap-2 font-bold border border-sakura-border/30"
      style={{
        backgroundColor: 'var(--tg-theme-secondary-bg-color, #2D2438)',
        color: 'var(--tg-theme-text-color, #fff)',
      }}
    >
      <UserPlus size={20} />
      <span>{inviteLabel}</span>
    </button>
  </div>
)

export default QuickActions
