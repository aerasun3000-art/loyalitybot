#!/bin/bash
# Скрипт для установки libzbar для arm64 архитектуры
# Этот скрипт устанавливает нативный Homebrew (arm64) и через него zbar
# Не затрагивает существующий x86_64 Homebrew в /usr/local

set -e

echo "🔍 Проверяю текущее состояние..."

# Проверяем, установлен ли нативный Homebrew
if [ -f /opt/homebrew/bin/brew ]; then
    echo "✅ Нативный Homebrew уже установлен в /opt/homebrew"
    BREW_CMD="/opt/homebrew/bin/brew"
else
    echo "📦 Устанавливаю нативный Homebrew для arm64..."
    echo "   (Это может потребовать ввода пароля администратора)"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    if [ -f /opt/homebrew/bin/brew ]; then
        BREW_CMD="/opt/homebrew/bin/brew"
        echo "✅ Нативный Homebrew успешно установлен"
        
        # Добавляем в PATH для текущей сессии
        eval "$($BREW_CMD shellenv)"
        
        # Добавляем в .zshrc, если еще не добавлено
        if ! grep -q "/opt/homebrew/bin/brew" ~/.zshrc 2>/dev/null; then
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
            echo "✅ Добавлено в ~/.zshrc"
        fi
    else
        echo "❌ Ошибка установки Homebrew"
        exit 1
    fi
fi

echo ""
echo "📦 Устанавливаю zbar через нативный Homebrew..."
$BREW_CMD install zbar

echo ""
echo "🔍 Проверяю установку..."
if [ -f /opt/homebrew/lib/libzbar.dylib ]; then
    ARCH=$(file /opt/homebrew/lib/libzbar.dylib | grep -o "arm64\|x86_64")
    if [ "$ARCH" = "arm64" ]; then
        echo "✅ zbar установлен для arm64 архитектуры"
    else
        echo "⚠️  zbar установлен, но архитектура: $ARCH (ожидалось arm64)"
    fi
else
    echo "❌ libzbar.dylib не найден"
    exit 1
fi

echo ""
echo "🐍 Проверяю работу pyzbar..."
if python3 -c "from pyzbar.pyzbar import decode; print('✅ pyzbar работает!')" 2>/dev/null; then
    echo "✅ Всё готово! QR-декодирование должно работать."
else
    echo "⚠️  pyzbar не может загрузить libzbar"
    echo "   Попробуйте переустановить pyzbar:"
    echo "   pip3 uninstall pyzbar && pip3 install pyzbar"
fi

echo ""
echo "🔄 Не забудьте перезапустить бота после установки!"

