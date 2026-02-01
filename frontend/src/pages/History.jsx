import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getClientTransactions, getClientBalance, getClientNpsRatings, upsertNpsRating } from '../services/supabase'
import { getChatId, hapticFeedback } from '../utils/telegram'
import { formatCurrencySimple } from '../utils/currency'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import Loader from '../components/Loader'

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
        runningBalance -= txn.earned_points || 0
      } else if (txn.operation_type === 'redemption') {
        runningBalance += txn.spent_points || 0
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
        return '💰'
      case 'enrollment_bonus':
        return '🎁'
      case 'redemption':
        return '🎯'
      default:
        return '📝'
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
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 pt-6 pb-8">
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-white mr-3"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-white">{t('history_title')}</h1>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">📈</span>
              <span className="text-white/80 text-sm">{t('history_earned')}</span>
            </div>
            <span className="text-white font-bold text-2xl">+{totalEarned}</span>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">📉</span>
              <span className="text-white/80 text-sm">{t('history_spent')}</span>
            </div>
            <span className="text-white font-bold text-2xl">-{totalSpent}</span>
          </div>
        </div>

      <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 mb-4">
        <span className="text-white/80 text-sm block">{t('profile_balance')}</span>
        <span className="text-white font-bold text-2xl">{currentBalance} {language === 'ru' ? 'баллов' : 'points'}</span>
      </div>

        {/* Фильтры */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap ${
              filter === 'all'
                ? 'bg-white text-orange-500'
                : 'bg-white/20 text-white'
            }`}
          >
            {t('history_all')} ({transactions.length})
          </button>
          <button
            onClick={() => handleFilterChange('accrual')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap ${
              filter === 'accrual'
                ? 'bg-white text-orange-500'
                : 'bg-white/20 text-white'
            }`}
          >
            {t('history_accruals')}
          </button>
          <button
            onClick={() => handleFilterChange('redemption')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap ${
              filter === 'redemption'
                ? 'bg-white text-orange-500'
                : 'bg-white/20 text-white'
            }`}
          >
            {t('history_redemptions')}
          </button>
        </div>
      </div>

      {/* Список транзакций */}
      <div className="px-4 -mt-4 pb-20">
        {filteredTransactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <span className="text-6xl leading-none mx-auto mb-4 block text-jewelry-gray-elegant">🚫</span>
            <p className="text-gray-600">{t('history_no_items')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTransactions).map(([date, dayTransactions]) => (
              <div key={date}>
                <h2 className="text-sm font-semibold text-gray-500 mb-3 px-2">
                  {date}
                </h2>
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                  {dayTransactions.map((transaction, index) => {
                    const isAccrual = transaction.operation_type === 'accrual' || 
                                     transaction.operation_type === 'enrollment_bonus'
                    const showRate = (transaction.operation_type === 'accrual' || transaction.operation_type === 'redemption') && transaction.partner_chat_id
                    const partnerRating = showRate ? npsRatings[transaction.partner_chat_id] : null
                    
                    return (
                      <div
                        key={transaction.id}
                        className={`flex items-center gap-3 p-4 ${
                          index !== dayTransactions.length - 1 ? 'border-b border-gray-100' : ''
                        }`}
                      >
                        {/* Иконка */}
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          isAccrual ? 'bg-green-100' : 'bg-orange-100'
                        }`}>
                          <span className="text-2xl">
                            {getTransactionIcon(transaction.operation_type)}
                          </span>
                        </div>

                        {/* Информация */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-800 text-sm mb-0.5 truncate">
                            {getTransactionTypeLabel(transaction.operation_type)}
                          </h3>
                          {(transaction.operation_type === 'accrual' || transaction.operation_type === 'redemption') && (
                            <p className="text-xs text-gray-600 truncate">
                              {getPartnerDisplayName(transaction)}
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            {formatDate(transaction.date_time)}
                          </p>
                          {typeof transaction.balance_after === 'number' && (
                            <p className="text-xs text-gray-400 mt-1">
                              {t('history_balance_after')}: {transaction.balance_after} {language === 'ru' ? 'баллов' : 'points'}
                            </p>
                          )}
                          {showRate && (
                            <div className="mt-2 flex items-center gap-2">
                              {partnerRating ? (
                                <>
                                  <span className="text-xs text-gray-600">
                                    {t('history_rated', { rating: partnerRating.rating })}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => openRatingModal(transaction)}
                                    className="text-xs text-orange-500 font-medium hover:underline"
                                  >
                                    {t('history_change_rating')}
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openRatingModal(transaction)}
                                  className="text-xs text-orange-500 font-semibold hover:underline"
                                >
                                  {t('history_rate')}
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Баллы */}
                        <div className="text-right">
                          <div className={`font-bold text-lg ${
                            isAccrual ? 'text-green-500' : 'text-orange-500'
                          }`}>
                            {isAccrual ? '+' : '-'}
                            {transaction.earned_points || transaction.spent_points || 0}
                          </div>
                          {transaction.total_amount > 0 && (
                            <div className="text-xs text-gray-500">
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={closeRatingModal}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">{t('history_rate')}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{getPartnerDisplayName(ratingModal.transaction)}</p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">0–10 (NPS)</p>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRatingForm(prev => ({ ...prev, rating: n }))}
                      className={`w-9 h-9 rounded-lg font-semibold text-sm ${
                        ratingForm.rating === n
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('history_rating_comment')}</label>
                <textarea
                  value={ratingForm.feedback}
                  onChange={e => setRatingForm(prev => ({ ...prev, feedback: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm min-h-[80px]"
                  placeholder={language === 'ru' ? 'По желанию' : 'Optional'}
                />
              </div>
              {ratingError && (
                <p className="text-sm text-red-600" role="alert">{ratingError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeRatingModal}
                  className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium"
                >
                  {t('services_cancel')}
                </button>
                <button
                  type="button"
                  onClick={submitRating}
                  disabled={ratingSubmitting || (ratingForm.rating < 0 || ratingForm.rating > 10)}
                  className="flex-1 py-2.5 rounded-lg bg-orange-500 text-white font-semibold disabled:opacity-50"
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
    </div>
  )
}

export default History

