import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { getApiBaseUrl } from '../services/supabase'

export default function TonDeposit({ partnerChatId, onClose }) {
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [copiedComment, setCopiedComment] = useState(false)
  const canvasRef = useRef(null)

  useEffect(() => {
    const apiBase = getApiBaseUrl()
    if (!apiBase) { setLoading(false); return }
    fetch(`${apiBase}/api/ton/deposit-info?partner_chat_id=${encodeURIComponent(partnerChatId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setInfo(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [partnerChatId])

  useEffect(() => {
    if (info && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, info.platform_address, {
        width: 180,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })
    }
  }, [info])

  const copy = (text, setter) => {
    navigator.clipboard.writeText(text).then(() => {
      setter(true)
      setTimeout(() => setter(false), 2000)
    })
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Загрузка...</div>
  }

  if (!info || info.error) {
    return <div className="p-8 text-center text-red-500">Не удалось загрузить данные</div>
  }

  return (
    <div className="p-5 max-w-sm mx-auto">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        💰 Пополнить депозит (USDT)
      </h2>

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-blue-700 dark:text-blue-300">Курс пополнения</span>
          <span className="font-bold text-blue-900 dark:text-blue-100">1 USDT = {info.usd_rub_rate} баллов</span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-blue-700 dark:text-blue-300">Текущий депозит</span>
          <span className="font-bold text-blue-900 dark:text-blue-100">{Number(info.current_deposit).toLocaleString('ru-RU')} баллов</span>
        </div>
      </div>

      <div className="flex justify-center mb-4 bg-white rounded-xl p-3 shadow-sm">
        <canvas ref={canvasRef} className="rounded" />
      </div>

      <div className="mb-3">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Адрес кошелька (сеть TON)</p>
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
          <p className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate flex-1">
            {info.platform_address}
          </p>
          <button
            onClick={() => copy(info.platform_address, setCopiedAddress)}
            className="text-blue-500 dark:text-blue-400 text-xs whitespace-nowrap font-medium"
          >
            {copiedAddress ? '✓' : 'Копировать'}
          </button>
        </div>
      </div>

      <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">⚠️ Обязательно укажите комментарий</p>
        <div className="flex items-center gap-2 mt-1">
          <p className="font-mono font-bold text-amber-900 dark:text-amber-100 text-sm flex-1">{info.comment}</p>
          <button
            onClick={() => copy(info.comment, setCopiedComment)}
            className="text-amber-700 dark:text-amber-300 text-xs whitespace-nowrap font-medium"
          >
            {copiedComment ? '✓' : 'Копировать'}
          </button>
        </div>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
          Без комментария баллы не зачислятся автоматически.
        </p>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5 mb-5">
        <p>• Сеть: <strong>TON</strong> (не Ethereum/ERC-20)</p>
        <p>• Токен: <strong>USDT (USD₮)</strong></p>
        <p>• Баллы зачисляются в течение 1–2 минут</p>
        <p>• Минимальная сумма: 1 USDT</p>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium"
        >
          Закрыть
        </button>
      )}
    </div>
  )
}
