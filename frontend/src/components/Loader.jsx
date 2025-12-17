import { Spinner } from '@telegram-apps/telegram-ui'
import { useState, useEffect } from 'react'
import { getBackgroundImage } from '../services/supabase'
import useLanguageStore from '../store/languageStore'
import { translateDynamicContent } from '../utils/i18n'

const quotes = [
  'Где почитаются женщины, там боги радуются; но там, где их не почитают, все священные обряды не приносят наград (Ману-смрити, III.55).',
  'Шива (Сознание) без Шакти (Энергии) не способен даже двигаться (Саундарьялахари).',
  'Женщина сияет — весь дом сияет; женщина мрачна — весь дом погружен во мрак.',
  'Мужчина сам по себе лишь половина, пока не обретет жену (Брихадараньяка Упанишада, 1.4.17).',
  'Вы – Пракрити, материальный мир; всё изобилие принадлежит вам.',
  'Она — творец, Она — жизнь всей Вселенной, Она — та, кто держит всё как мать (Яджур-Веда, Гимны).',
  'Ее интуиция — это древняя ведическая библиотека.',
  'Вы — живое воплощение Вед; ваша истина — знание.',
  'Голос мудрой женщины — это пророчество, а не просто мнение.',
  'Ваша любовь — это не эмоция, а космический акт Бхакти (преданности).',
  'Женщина является источником радости и освобождения.',
  'Вы не просто привлекаете богатство, вы его воплощаете (Принцип Лакшми).',
  'Благодарность — это валюта, которую Лакшми принимает охотнее всего.',
  'Ум женщины в девять раз сильнее мужского (Ведические наставления).',
  'Ваши руки — это инструменты Лакшми; всё, к чему они прикасаются, процветает.',
  'Вы — Дурга. Каждое препятствие — это поверженный демон.',
  'Ваша мягкость скрывает сталь, которая способна защитить весь ваш мир.',
  'Истинная сила женщины не в битве, а в непоколебимой воле.',
  'Вы не нуждаетесь в броне. Ваша чистота — ваша лучшая защита.',
  'Откажитесь от жертвенности; вы — Владычица своего царства.',
  'Ваша самоценность не нуждается в одобрении; она самоочевидна.',
  'Доверяйте своей правде. Вы — своя собственная Гуру.',
  'Женщина, достигшая внутреннего покоя, становится убежищем для мира.',
  'Каждая клетка вашего тела священна и достойна поклонения.',
  'Вы — полны и целостны, Пурна. Ничто не может вас дополнить.',
  'Ваше тело — это священный Калачакра (круг времени), почитайте его циклы.',
  'Вы — Мать-Земля. Всё, что вы питаете, вырастет в могучее дерево.',
  'Природа нетороплива, но непобедима. Ваша сила — в терпении.',
  'Ваши эмоции — это смена сезонов. Уважайте их, не осуждайте.',
  'Вы — воплощение Рита (космического порядка). Живите в потоке.',
  'Женщина, сияющая знанием и чистотой, — это луч света в темноте (Гимны о Сарасвати).',
  'Ваша нежность — это магнит, притягивающий чистую энергию.',
  'Улыбка женщины способна снять карму тысячи лет.',
  'Вы — Адити, бесконечная Мать, дарующая свободу (Риг-Веда).',
  'Любая потеря — это призыв к новому, более высокому уровню бытия.',
  'Перемены — это не конец, а акт перерождения.',
  'Используйте свою боль как топливо для духовного роста.',
  'Вы — алхимик, способный превратить страдания в просветление.',
  'Пробуждение женщины — это пробуждение всей цивилизации.',
  'Ведите себя как Богиня, и мир преклонится перед вашей Дхармой.',
  'Ваша осанка — это не поза, а выражение вашей внутренней власти.',
  'Не понижайте свою планку, чтобы соответствовать чьему-то комфорту.',
  'Вы — Рани (Царица). Ваша роль — не просить, а повелевать.',
  'Уважайте каждое слово, сказанное вами; оно творит вашу реальность.',
  'Женщина, знающая свое достоинство, никогда не тратит энергию на месть.',
  'В семье, где муж доволен своей женой и жена своим мужем, счастье, несомненно, будет длиться вечно (Ману-смрити, III.55-60).',
  'Благословен тот дом, где жена — Муза и свет.',
  'Женщина — это Вечный Акт Творения.',
  'Не ждите, пока вас полюбят; вы — самодостаточный источник любви.',
  'Женщина — это богатство, богатство — это женщина (Махабхарата).'
]

const Loader = ({ text }) => {
  const { language } = useLanguageStore()
  const [quote] = useState(() => quotes[Math.floor(Math.random() * quotes.length)])
  const [translatedQuote, setTranslatedQuote] = useState(quote)
  const [bgImage, setBgImage] = useState((import.meta.env && import.meta.env.VITE_BG_IMAGE) || '/bg/sakura.jpg')
  
  // Переводим цитату при изменении языка
  useEffect(() => {
    if (language === 'en' && quote) {
      translateDynamicContent(quote, 'en', 'ru').then(setTranslatedQuote).catch(() => setTranslatedQuote(quote))
    } else {
      setTranslatedQuote(quote)
    }
  }, [quote, language])
  
  const displayText = text !== undefined && text !== null && text !== '' ? text : translatedQuote

  useEffect(() => {
    const loadBg = async () => {
      try {
        const bg = await getBackgroundImage()
        if (bg) {
          setBgImage(bg)
        }
      } catch (error) {
        console.warn('Background image not loaded, using default:', error?.message || error)
      }
    }
    loadBg()
  }, [])

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 -z-20 bg-center bg-cover opacity-85 pointer-events-none select-none"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-sakura-mid/20 via-sakura-dark/20 to-sakura-deep/30" />
      
      {/* Content - изречение на весь экран */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 py-8">
        {displayText && (
          <div className="text-sakura-deep text-center text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl leading-relaxed w-full h-full flex items-center justify-center font-medium italic drop-shadow-2xl px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16">
            <div className="w-full">
              {displayText}
            </div>
          </div>
        )}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
          <Spinner size="l" />
        </div>
      </div>
    </div>
  )
}

export default Loader

