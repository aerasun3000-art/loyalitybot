# Исправление конфликта архитектуры libzbar на macOS (Apple Silicon)

## Проблема

Ошибка при запуске партнёрского бота:
```
OSError: dlopen(/usr/local/lib/libzbar.dylib, 0x0006): tried: '/usr/local/lib/libzbar.dylib' (mach-o file, but is an incompatible architecture (have 'x86_64', need 'arm64e' or 'arm64'))
```

Проблема в том, что установлена версия libzbar для x86_64 (Intel), а нужна для arm64 (Apple Silicon).

## Решение 1: Установка правильной версии libzbar (Рекомендуется)

### Вариант A: Через Homebrew

```bash
# Удалить старую версию (если установлена)
brew uninstall zbar

# Установить для arm64
arch -arm64 brew install zbar

# Проверить установку
which zbarimg
file $(which zbarimg)
```

### Вариант B: Через conda (если используете conda)

```bash
conda install -c conda-forge zbar
```

### Вариант C: Ручная установка из исходников

```bash
# Установить зависимости
brew install autoconf automake libtool gettext libiconv

# Клонировать и собрать
git clone https://github.com/mchehab/zbar.git
cd zbar
./autogen.sh
./configure --prefix=/opt/homebrew
make && make install
```

## Решение 2: Graceful fallback (временное решение)

Если не можете установить libzbar сейчас, можно сделать обработку ошибки более мягкой:

Бот будет работать, но QR-декодирование будет отключено. Партнёры смогут вводить CLIENT_ID вручную.

## Решение 3: Использовать альтернативную библиотеку

Можно заменить pyzbar на другую библиотеку, но это потребует изменения кода.

## Проверка после установки

```bash
# Проверить архитектуру библиотеки
file /opt/homebrew/lib/libzbar.dylib
# Должно быть: Mach-O 64-bit dynamically linked shared library arm64

# Проверить в Python
python3 -c "from pyzbar.pyzbar import decode; print('OK')"
```

## Если проблема остаётся

1. Убедитесь, что используете правильный Python (arm64):
   ```bash
   which python3
   file $(which python3)
   # Должно быть: Mach-O universal binary with 2 architectures: [x86_64:Mach-O 64-bit executable x86_64] [arm64:Mach-O 64-bit executable arm64]
   ```

2. Переустановите pyzbar:
   ```bash
   pip uninstall pyzbar
   pip install pyzbar
   ```

3. Проверьте переменные окружения:
   ```bash
   echo $DYLD_LIBRARY_PATH
   echo $LD_LIBRARY_PATH
   ```

## Примечание

QR-декодирование используется только в партнёрском боте для сканирования QR-кодов клиентов. Если эта функция критична, лучше установить правильную версию libzbar.

Если QR-декодирование не критично, можно оставить graceful fallback и партнёры будут вводить CLIENT_ID вручную.

