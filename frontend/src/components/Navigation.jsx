import { useLocation, useNavigate } from 'react-router-dom'
import { Tabbar } from '@telegram-apps/telegram-ui'
import { hapticFeedback } from '../utils/telegram'

const Navigation = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const handleNavigation = (path) => {
    hapticFeedback('light')
    navigate(path)
  }

  const isActive = (path) => location.pathname === path

  return (
    <Tabbar className="fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-800">
      <Tabbar.Item
        selected={isActive('/')}
        onClick={() => handleNavigation('/')}
        text="Главная"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M14 4L4 12V24H10V18H18V24H24V12L14 4Z"
            fill="currentColor"
          />
        </svg>
      </Tabbar.Item>

      <Tabbar.Item
        selected={isActive('/promotions')}
        onClick={() => handleNavigation('/promotions')}
        text="Акции"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M20 6H8C6.9 6 6 6.9 6 8V20C6 21.1 6.9 22 8 22H20C21.1 22 22 21.1 22 20V8C22 6.9 21.1 6 20 6ZM10 18C9.45 18 9 17.55 9 17C9 16.45 9.45 16 10 16C10.55 16 11 16.45 11 17C11 17.55 10.55 18 10 18ZM10 12C9.45 12 9 11.55 9 11C9 10.45 9.45 10 10 10C10.55 10 11 10.45 11 11C11 11.55 10.55 12 10 12ZM18 18C17.45 18 17 17.55 17 17C17 16.45 17.45 16 18 16C18.55 16 19 16.45 19 17C19 17.55 18.55 18 18 18ZM18 12C17.45 12 17 11.55 17 11C17 10.45 17.45 10 18 10C18.55 10 19 10.45 19 11C19 11.55 18.55 12 18 12Z"
            fill="currentColor"
          />
        </svg>
      </Tabbar.Item>

      <Tabbar.Item
        selected={isActive('/services')}
        onClick={() => handleNavigation('/services')}
        text="Услуги"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19ZM17.99 9L16.58 7.58L9.99 14.17L7.41 11.6L5.99 13.01L9.99 17L17.99 9Z"
            fill="currentColor"
          />
        </svg>
      </Tabbar.Item>

      <Tabbar.Item
        selected={isActive('/history')}
        onClick={() => handleNavigation('/history')}
        text="История"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M14 4C8.48 4 4 8.48 4 14C4 19.52 8.48 24 14 24C19.52 24 24 19.52 24 14C24 8.48 19.52 4 14 4ZM14 22C9.59 22 6 18.41 6 14C6 9.59 9.59 6 14 6C18.41 6 22 9.59 22 14C22 18.41 18.41 22 14 22ZM14.5 9H13V15L18.25 18.15L19 16.92L14.5 14.25V9Z"
            fill="currentColor"
          />
        </svg>
      </Tabbar.Item>

      <Tabbar.Item
        selected={isActive('/profile')}
        onClick={() => handleNavigation('/profile')}
        text="Профиль"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M14 4C11.79 4 10 5.79 10 8C10 10.21 11.79 12 14 12C16.21 12 18 10.21 18 8C18 5.79 16.21 4 14 4ZM14 14C10.67 14 4 15.67 4 19V22H24V19C24 15.67 17.33 14 14 14Z"
            fill="currentColor"
          />
        </svg>
      </Tabbar.Item>
    </Tabbar>
  )
}

export default Navigation

