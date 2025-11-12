import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getClientTransactions, getClientBalance } from '../services/supabase'
import { getChatId, hapticFeedback } from '../utils/telegram'
// import LuxuryIcon from '../components/LuxuryIcons'
import Loader from '../components/Loader'

const History = () => {
  const navigate = useNavigate()
  const chatId = getChatId()
  
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState([])
  const [currentBalance, setCurrentBalance] = useState(0)
  const [filter, setFilter] = useState('all') // all, accrual, redemption

  useEffect(() => {
    loadTransactions()
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

  const getTransactionTitle = (transaction) => {
    switch (transaction.operation_type) {
      case 'accrual':
        return `Покупка у ${transaction.partner?.company_name || transaction.partner?.name || 'партнёра'}`
      case 'enrollment_bonus':
        return 'Бонус за регистрацию'
      case 'redemption':
        return 'Обмен баллов на услугу'
      default:
        return 'Операция'
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return `Сегодня, ${date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Вчера, ${date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString('ru', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  // Группировка транзакций по дням
  const groupByDate = (transactions) => {
    const groups = {}
    transactions.forEach(t => {
      const date = new Date(t.date_time).toLocaleDateString('ru', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(t)
    })
    return groups
  }

  if (loading) {
    return <Loader text="Загрузка истории..." />
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
          <h1 className="text-2xl font-bold text-white">История</h1>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">📈</span>
              <span className="text-white/80 text-sm">Начислено</span>
            </div>
            <span className="text-white font-bold text-2xl">+{totalEarned}</span>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">📉</span>
              <span className="text-white/80 text-sm">Потрачено</span>
            </div>
            <span className="text-white font-bold text-2xl">-{totalSpent}</span>
          </div>
        </div>

      <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 mb-4">
        <span className="text-white/80 text-sm block">Текущий баланс</span>
        <span className="text-white font-bold text-2xl">{currentBalance} баллов</span>
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
            Все ({transactions.length})
          </button>
          <button
            onClick={() => handleFilterChange('accrual')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap ${
              filter === 'accrual'
                ? 'bg-white text-orange-500'
                : 'bg-white/20 text-white'
            }`}
          >
            Начисления
          </button>
          <button
            onClick={() => handleFilterChange('redemption')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap ${
              filter === 'redemption'
                ? 'bg-white text-orange-500'
                : 'bg-white/20 text-white'
            }`}
          >
            Списания
          </button>
        </div>
      </div>

      {/* Список транзакций */}
      <div className="px-4 -mt-4 pb-20">
        {filteredTransactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <span className="text-6xl leading-none mx-auto mb-4 block text-jewelry-gray-elegant">🚫</span>
            <p className="text-gray-600">История транзакций пуста</p>
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
                            {getTransactionTitle(transaction)}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {formatDate(transaction.date_time)}
                          </p>
                          {typeof transaction.balance_after === 'number' && (
                            <p className="text-xs text-gray-400 mt-1">
                              Баланс после операции: {transaction.balance_after} баллов
                            </p>
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
                              {transaction.total_amount} ₽
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

