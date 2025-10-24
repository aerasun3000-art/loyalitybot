import { Spinner } from '@telegram-apps/telegram-ui'

const Loader = ({ text = 'Загрузка...' }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
      <Spinner size="l" />
      {text && <p className="text-gray-500">{text}</p>}
    </div>
  )
}

export default Loader

