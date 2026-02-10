/**
 * BookingTemplate - Шаблон страницы партнёра для записи на услуги
 * 
 * Используется для: beauty, fitness, education, healthcare, entertainment, influencer, activity
 * 
 * Модули:
 * - HeroModule (обязательный)
 * - HeaderModule (обязательный)
 * - ServicesModule (обязательный)
 * - SpecialistsModule (опциональный)
 * - PortfolioModule (опциональный)
 * - LocationModule (обязательный)
 * - CTAFooterModule (обязательный)
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HeroModule,
  HeaderModule,
  ServicesModule,
  SpecialistsModule,
  PortfolioModule,
  LocationModule,
  CTAFooterModule
} from '../modules'
import { getModuleConfig } from '../../utils/templateConfig'
import { hapticFeedback } from '../../utils/telegram'

const BookingTemplate = ({ 
  partner, 
  services = [],
  specialists = [],
  portfolioPhotos = [],
  rating,
  reviewsCount,
  distance
}) => {
  const navigate = useNavigate()
  const [selectedService, setSelectedService] = useState(null)
  const [selectedSpecialist, setSelectedSpecialist] = useState(null)
  
  // Получаем конфигурацию модулей
  const config = getModuleConfig(partner?.category_group, partner?.ui_config)
  
  // Обработка выбора услуги
  const handleServiceSelect = (service) => {
    hapticFeedback('light')
    setSelectedService(service)
    // Можно добавить логику перехода к бронированию
  }
  
  // Обработка выбора специалиста
  const handleSpecialistSelect = (specialist) => {
    hapticFeedback('light')
    setSelectedSpecialist(
      selectedSpecialist?.id === specialist.id ? null : specialist
    )
  }
  
  // Обработка кнопки "Назад"
  const handleBack = () => {
    hapticFeedback('light')
    navigate(-1)
  }

  return (
    <div className="min-h-screen bg-sakura-cream pb-24">
      {/* Hero изображение */}
      <HeroModule 
        partner={partner}
        height="40vh"
        showBackButton={true}
        onBack={handleBack}
      />
      
      {/* Заголовок */}
      <div className="-mt-6 relative z-10">
        <div className="bg-sakura-surface rounded-t-3xl">
          <HeaderModule 
            partner={partner}
            rating={rating}
            reviewsCount={reviewsCount}
            distance={distance}
            showCategory={true}
          />
        </div>
      </div>
      
      {/* Разделитель */}
      <div className="h-2 bg-sakura-cream" />
      
      {/* Услуги */}
      <ServicesModule 
        services={services}
        partner={partner}
        onServiceSelect={handleServiceSelect}
        selectedServiceId={selectedService?.id}
        showDuration={true}
        showImage={true}
        showTags={true}
      />
      
      {/* Специалисты (если включен модуль) */}
      {config.modules.specialists && (
        <>
          <div className="h-2 bg-sakura-cream" />
          <SpecialistsModule 
            partnerId={partner?.chat_id}
            specialists={specialists}
            onSpecialistSelect={handleSpecialistSelect}
            selectedSpecialistId={selectedSpecialist?.id}
          />
        </>
      )}
      
      {/* Портфолио (если включен модуль) */}
      {config.modules.portfolio && (
        <>
          <div className="h-2 bg-sakura-cream" />
          <PortfolioModule 
            partnerId={partner?.chat_id}
            photos={portfolioPhotos}
            maxVisible={4}
          />
        </>
      )}
      
      {/* Локация и контакты */}
      <div className="h-2 bg-sakura-cream" />
      <LocationModule 
        partner={partner}
        showMap={true}
        showWorkingHours={true}
        showContacts={true}
      />
      
      {/* Sticky CTA кнопка */}
      <CTAFooterModule 
        action={config.cta.primary}
        url={partner?.booking_url}
        partner={partner}
        secondaryAction={config.cta.secondary}
      />
    </div>
  )
}

export default BookingTemplate
