import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getClientTransactions, getClientBalance, getClientNpsRatings, upsertNpsRating } from '../services/supabase'
import { getChatId, hapticFeedback } from '../utils/telegram'
import { formatCurrencySimple } from '../utils/currency'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import Loader from '../components/Loader'
import Layout from '../components/Layout'
import { TrendingUp, TrendingDown, Wallet, Gift, Target, FileText, Star } from 'lucide-react'

const History = () => {
  const navigate = useNavigate()
  const chatId = getChatId()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)

  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState([])
  const [currentBalance, setCurrentBalance] = useState(0)
  const [filter, setFilter] = useState('all')
  const [npsRatings, setNpsRatings] = useState({})
  const [ratingModal, setRatingModal] = useState({ open: false, transaction: null })
  const [ratingForm, setRatingForm] = useState({ rating: 0, feedback: '' })
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [ratingError, setRatingError] = useState(null)

  useEffect(() => {
    loadTransactions()
  }, [chatId])

  const loadNpsRatings = async () => {
    if (!chatId) return
    const ratings = await getClientNpsRatings(chatId)
    setNpsRatings(ratings)
  }

  useEffect(() => {
    loadNpsRatings()
  }, [chatId])

  const annotateTransactions = (txs, balanceValue) => {
    if (!Array.isArray(txs)) {
      return []
    }

    let runningBalance = typeof balanceValue === 'number' ? balanceValue : 0

    return txs.map(txn => {
      const balanceAfter = runningBalance

      if (txn.operation_type === 'accrual' || txn.operation_type === 'enrollment_bonus') {
        runningBalance += txn.earned_points || 0
      } else if (txn.operation_type === 'redemption') {
        runningBalance -= txn.spent_points || 0
      }

      return {
        ...txn,
        balance_after: balanceAfter
      }
    })
  }

  const loadTransactions = async () => {
    try {
      setLoading(true)
      const [balanceData, data] = await Promise.all([
        getClientBalance(chatId),
        getClientTransactions(chatId, 100)
      ])

      const balanceValue = balanceData?.balance ?? 0
      setCurrentBalance(balanceValue)
      setTransactions(annotateTransactions(data, balanceValue))
    } catch (error) {
      console.error('Error loading transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredTransactions = () => {
    switch (filter) {
      case 'accrual':
        return transactions.filter(t =>
          t.operation_type === 'accrual' || t.operation_type === 'enrollment_bonus'
        )
      case 'redemption':
        return transactions.filter(t => t.operation_type === 'redemption')
      default:
        return transactions
    }
  }

  const handleFilterChange = (newFilter) => {
    hapticFeedback('light')
    setFilter(newFilter)
  }

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'accrual':
        return <Wallet size={20} />
      case 'enrollment_bonus':
        return <Gift size={20} />
      case 'redemption':
        return <Target size={20} />
      default:
        return <FileText size={20} />
    }
  }

  const getTransactionTypeLabel = (operationType) => {
    switch (operationType) {
      case 'accrual':
        return t('history_type_accrual')
      case 'enrollment_bonus':
        return t('history_type_enrollment_bonus')
      case 'redemption':
        return t('history_type_redemption')
      default:
        return t('history_operation')
    }
  }

  const getPartnerDisplayName = (transaction) => {
    return transaction.partner?.company_name || transaction.partner?.name || t('history_partner')
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const locale = language === 'ru' ? 'ru' : 'en-US'
    if (date.toDateString() === today.toDateString()) {
      return `${t('history_today')}, ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `${t('history_yesterday')}, ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  const openRatingModal = (transaction) => {
    const pid = transaction.partner_chat_id
    const existing = pid ? npsRatings[pid] : null
    setRatingForm({
      rating: existing?.rating ?? 0,
      feedback: existing?.feedback ?? ''
    })
    setRatingModal({ open: true, transaction })
  }

  const closeRatingModal = () => {
    setRatingModal({ open: false, transaction: null })
    setRatingError(null)
  }

  const submitRating = async () => {
    const { transaction } = ratingModal
    if (!transaction || !chatId || !transaction.partner_chat_id || ratingForm.rating < 0 || ratingForm.rating > 10) return
    setRatingSubmitting(true)
    setRatingError(null)
    try {
      await upsertNpsRating(
        chatId,
        transaction.partner_chat_id,
        ratingForm.rating,
        ratingForm.feedback || '',
        getPartnerDisplayName(transaction)
      )
      await loadNpsRatings()
      closeRatingModal()
    } catch (err) {
      console.error('Error saving NPS rating:', err)
      setRatingError(err?.message || t('error_something_wrong'))
    } finally {
      setRatingSubmitting(false)
    }
  }

  const groupByDate = (txs) => {
    const groups = {}
    const locale = language === 'ru' ? 'ru' : 'en-US'
    txs.forEach(t => {
      const date = new Date(t.date_time).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
      if (!groups[date]) groups[date] = []
      groups[date].push(t)
    })
    return groups
  }

  if (loading) {
    return <Loader text={t('loading_history')} />
  }

  const filteredTransactions = getFilteredTransactions()
  const groupedTransactions = groupByDate(filteredTransactions)

  // Подсчёт статистики
  const totalEarned = transactions
    .filter(t => t.operation_type === 'accrual' || t.operation_type === 'enrollment_bonus')
    .reduce((sum, t) => sum + (t.earned_points || 0), 0)

  const totalSpent = transactions
    .filter(t => t.operation_type === 'redemption')
    .reduce((sum, t) => sum + (t.spent_points || 0), 0)

  return (
    <Layout>
      <div className="max-w-screen-sm mx-auto px-4 flex flex-col gap-4">
        {/* Заголовок */}
        <h1 className="text-xl font-bold pt-2">{t('history_title')}</h1>

        {/* Статистика */}
        <div className="grid grid-cols-3 gap-2">
          <div
            className="rounded-2xl p-3 text-center"
            style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
          >
            <TrendingUp size={20} className="mx-auto mb-1" style={{ color: 'var(--tg-theme-button-color)' }} />
            <div className="text-lg font-bold">+{totalEarned}</div>
            <div className="text-[11px]" style={{ color: 'var(--tg-theme-hint-color)' }}>{t('history_earned')}</div>
          </div>
          <div
            className="rounded-2xl p-3 text-center"
            style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
          >
            <TrendingDown size={20} className="mx-auto mb-1" style={{ color: 'var(--tg-theme-hint-color)' }} />
            <div className="text-lg font-bold">-{totalSpent}</div>
            <div className="text-[11px]" style={{ color: 'var(--tg-theme-hint-color)' }}>{t('history_spent')}</div>
          </div>
          <div
            className="rounded-2xl p-3 text-center"
            style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
          >
            <Wallet size={20} className="mx-auto mb-1" style={{ color: 'var(--tg-theme-button-color)' }} />
            <div className="text-lg font-bold">{currentBalance}</div>
            <div className="text-[11px]" style={{ color: 'var(--tg-theme-hint-color)' }}>{t('profile_balance')}</div>
          </div>
        </div>

        {/* Фильтры */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {[
            { id: 'all', label: `${t('history_all')} (${transactions.length})` },
            { id: 'accrual', label: t('history_accruals') },
            { id: 'redemption', label: t('history_redemptions') },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => handleFilterChange(f.id)}
              className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all active:scale-95"
              style={{
                backgroundColor: filter === f.id
                  ? 'var(--tg-theme-button-color)'
                  : 'var(--tg-theme-secondary-bg-color)',
                color: filter === f.id
                  ? 'var(--tg-theme-button-text-color, #fff)'
                  : 'var(--tg-theme-text-color)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Список транзакций */}
        {filteredTransactions.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
          >
            <FileText size={48} className="mx-auto mb-3" style={{ color: 'var(--tg-theme-hint-color)' }} />
            <p style={{ color: 'var(--tg-theme-hint-color)' }}>{t('history_no_items')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-4">
            {Object.entries(groupedTransactions).map(([date, dayTransactions]) => (
              <div key={date}>
                <h2 className="text-xs font-semibold mb-2 px-1" style={{ color: 'var(--tg-theme-hint-color)' }}>
                  {date}
                </h2>
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
                >
                  {dayTransactions.map((transaction, index) => {
                    const isAccrual = transaction.operation_type === 'accrual' ||
                                     transaction.operation_type === 'enrollment_bonus'
                    const showRate = (transaction.operation_type === 'accrual' || transaction.operation_type === 'redemption') && transaction.partner_chat_id
                    const partnerRating = showRate ? npsRatings[transaction.partner_chat_id] : null

                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center gap-3 p-4"
                        style={{
                          borderBottom: index !== dayTransactions.length - 1
                            ? '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)'
                            : 'none',
                        }}
                      >
                        {/* Иконка */}
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: isAccrual
                              ? 'color-mix(in srgb, var(--tg-theme-button-color) 15%, transparent)'
                              : 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)',
                            color: isAccrual
                              ? 'var(--tg-theme-button-color)'
                              : 'var(--tg-theme-hint-color)',
                          }}
                        >
                          {getTransactionIcon(transaction.operation_type)}
                        </div>

                        {/* Информация */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">
                            {getTransactionTypeLabel(transaction.operation_type)}
                          </h3>
                          {(transaction.operation_type === 'accrual' || transaction.operation_type === 'redemption') && (
                            <p className="text-xs truncate" style={{ color: 'var(--tg-theme-hint-color)' }}>
                              {getPartnerDisplayName(transaction)}
                            </p>
                          )}
                          <p className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>
                            {formatDate(transaction.date_time)}
                          </p>
                          {typeof transaction.balance_after === 'number' && (
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--tg-theme-hint-color)', opacity: 0.7 }}>
                              {t('history_balance_after')}: {transaction.balance_after} {language === 'ru' ? 'баллов' : 'points'}
                            </p>
                          )}
                          {showRate && (
                            <div className="mt-1.5 flex items-center gap-2">
                              {partnerRating ? (
                                <>
                                  <div className="flex items-center gap-1">
                                    <Star size={12} style={{ color: 'var(--tg-theme-button-color)' }} fill="var(--tg-theme-button-color)" />
                                    <span className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>
                                      {partnerRating.rating}/10
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => openRatingModal(transaction)}
                                    className="text-xs font-medium"
                                    style={{ color: 'var(--tg-theme-link-color)' }}
                                  >
                                    {t('history_change_rating')}
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openRatingModal(transaction)}
                                  className="text-xs font-semibold"
                                  style={{ color: 'var(--tg-theme-link-color)' }}
                                >
                                  {t('history_rate')}
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Баллы */}
                        <div className="text-right flex-shrink-0">
                          <div
                            className="font-bold text-base"
                            style={{
                              color: isAccrual
                                ? 'var(--tg-theme-button-color)'
                                : 'var(--tg-theme-text-color)',
                            }}
                          >
                            {isAccrual ? '+' : '-'}
                            {transaction.earned_points || transaction.spent_points || 0}
                          </div>
                          {transaction.total_amount > 0 && (
                            <div className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>
                              {formatCurrencySimple(transaction.total_amount, transaction.partner?.city)}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модалка оценки NPS */}
      {ratingModal.open && ratingModal.transaction && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={closeRatingModal}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative z-10 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl"
            style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="p-4"
              style={{ borderBottom: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }}
            >
              <h3 className="font-bold">{t('history_rate')}</h3>
              <p className="text-sm mt-0.5" style={{ color: 'var(--tg-theme-hint-color)' }}>
                {getPartnerDisplayName(ratingModal.transaction)}
              </p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">0–10 (NPS)</p>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRatingForm(prev => ({ ...prev, rating: n }))}
                      className="w-11 h-11 rounded-xl font-semibold text-sm transition-all active:scale-95"
                      style={{
                        backgroundColor: ratingForm.rating === n
                          ? 'var(--tg-theme-button-color)'
                          : 'var(--tg-theme-secondary-bg-color)',
                        color: ratingForm.rating === n
                          ? 'var(--tg-theme-button-text-color, #fff)'
                          : 'var(--tg-theme-text-color)',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('history_rating_comment')}</label>
                <textarea
                  value={ratingForm.feedback}
                  onChange={e => setRatingForm(prev => ({ ...prev, feedback: e.target.value }))}
                  className="w-full rounded-xl p-3 text-sm min-h-[80px] border-none outline-none resize-none"
                  style={{
                    backgroundColor: 'var(--tg-theme-secondary-bg-color)',
                    color: 'var(--tg-theme-text-color)',
                  }}
                  placeholder={language === 'ru' ? 'По желанию' : 'Optional'}
                />
              </div>
              {ratingError && (
                <p className="text-sm text-red-500" role="alert">{ratingError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeRatingModal}
                  className="flex-1 py-2.5 rounded-xl font-medium transition-all active:scale-95"
                  style={{
                    backgroundColor: 'var(--tg-theme-secondary-bg-color)',
                    color: 'var(--tg-theme-text-color)',
                  }}
                >
                  {t('services_cancel')}
                </button>
                <button
                  type="button"
                  onClick={submitRating}
                  disabled={ratingSubmitting || (ratingForm.rating < 0 || ratingForm.rating > 10)}
                  className="flex-1 py-2.5 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--tg-theme-button-color)',
                    color: 'var(--tg-theme-button-text-color, #fff)',
                  }}
                >
                  {ratingSubmitting ? (language === 'ru' ? 'Сохранение...' : 'Saving...') : t('history_rating_submit')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </Layout>
  )
}

export default History
