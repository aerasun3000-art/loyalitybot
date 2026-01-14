#!/usr/bin/env python3
"""
DevOps Agent для автоматизации задач LoyalityBot
Автоматизирует деплой, мониторинг и управление ботами
"""

import os
import sys
import subprocess
import json
import argparse
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from pathlib import Path
import requests

# Цвета для вывода
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_success(msg: str):
    print(f"{Colors.GREEN}✅ {msg}{Colors.RESET}")

def print_error(msg: str):
    print(f"{Colors.RED}❌ {msg}{Colors.RESET}")

def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.RESET}")

def print_info(msg: str):
    print(f"{Colors.BLUE}ℹ️  {msg}{Colors.RESET}")

def print_header(msg: str):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{msg}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}\n")

class DevOpsAgent:
    """DevOps агент для управления ботами и деплоями"""
    
    BOTS = {
        'admin': {
            'app': 'loyalitybot-admin',
            'config': 'fly.admin.toml',
            'script': 'admin_bot.py'
        },
        'partner': {
            'app': 'loyalitybot-partner',
            'config': 'fly.partner.toml',
            'script': 'bot.py'
        },
        'client': {
            'app': 'loyalitybot-client',
            'config': 'fly.client.toml',
            'script': 'client_handler.py'
        }
    }
    
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.flyctl_available = self._check_flyctl()
        
    def _check_flyctl(self) -> bool:
        """Проверяет наличие flyctl CLI"""
        try:
            result = subprocess.run(
                ['flyctl', '--version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False
    
    def _run_command(self, cmd: List[str], check: bool = True, capture: bool = False) -> Tuple[int, str, str]:
        """Выполняет команду и возвращает результат"""
        try:
            result = subprocess.run(
                cmd,
                capture_output=capture,
                text=True,
                timeout=300
            )
            stdout = result.stdout if capture else ""
            stderr = result.stderr if capture else ""
            
            if check and result.returncode != 0:
                print_error(f"Команда {' '.join(cmd)} завершилась с ошибкой")
                if capture:
                    print_error(f"Ошибка: {stderr}")
            
            return result.returncode, stdout, stderr
        except subprocess.TimeoutExpired:
            print_error(f"Команда {' '.join(cmd)} превысила время ожидания")
            return 1, "", "Timeout"
        except Exception as e:
            print_error(f"Ошибка при выполнении команды: {e}")
            return 1, "", str(e)
    
    def check_status(self, bot_name: Optional[str] = None) -> Dict:
        """Проверяет статус ботов на Fly.io"""
        print_header("Проверка статуса ботов")
        
        if not self.flyctl_available:
            print_warning("flyctl не установлен. Установите: brew install flyctl")
            return {}
        
        status = {}
        bots_to_check = [bot_name] if bot_name else self.BOTS.keys()
        
        for bot_key in bots_to_check:
            if bot_key not in self.BOTS:
                print_warning(f"Неизвестный бот: {bot_key}")
                continue
            
            bot = self.BOTS[bot_key]
            app_name = bot['app']
            
            print_info(f"Проверяю {bot_key} бот ({app_name})...")
            
            # Проверяем статус приложения
            code, stdout, _ = self._run_command(
                ['flyctl', 'status', '--app', app_name],
                check=False,
                capture=True
            )
            
            if code == 0:
                # Парсим статус
                if 'running' in stdout.lower() or 'started' in stdout.lower():
                    status[bot_key] = {'status': 'running', 'app': app_name}
                    print_success(f"{bot_key} бот работает")
                else:
                    status[bot_key] = {'status': 'unknown', 'app': app_name}
                    print_warning(f"{bot_key} бот: статус неопределён")
            else:
                status[bot_key] = {'status': 'not_found', 'app': app_name}
                print_warning(f"{bot_key} бот не найден на Fly.io")
        
        return status
    
    def deploy(self, bot_name: Optional[str] = None, remote_only: bool = True) -> bool:
        """Деплоит бота(ов) на Fly.io"""
        print_header("Деплой ботов")
        
        if not self.flyctl_available:
            print_error("flyctl не установлен. Установите: brew install flyctl")
            return False
        
        bots_to_deploy = [bot_name] if bot_name else self.BOTS.keys()
        success = True
        
        for bot_key in bots_to_deploy:
            if bot_key not in self.BOTS:
                print_warning(f"Неизвестный бот: {bot_key}")
                continue
            
            bot = self.BOTS[bot_key]
            app_name = bot['app']
            config_file = bot['config']
            
            # Проверяем существование конфига
            config_path = self.project_root / config_file
            if not config_path.exists():
                print_error(f"Конфиг {config_file} не найден")
                success = False
                continue
            
            print_info(f"Деплою {bot_key} бот ({app_name})...")
            
            # Проверяем, существует ли приложение
            code, _, _ = self._run_command(
                ['flyctl', 'apps', 'list'],
                check=False,
                capture=True
            )
            
            deploy_cmd = ['flyctl', 'deploy', '--config', config_file, '--app', app_name]
            if remote_only:
                deploy_cmd.append('--remote-only')
            
            code, stdout, stderr = self._run_command(
                deploy_cmd,
                check=False,
                capture=True
            )
            
            if code == 0:
                print_success(f"{bot_key} бот успешно задеплоен")
            else:
                print_error(f"Ошибка при деплое {bot_key} бота")
                if stderr:
                    print_error(f"Детали: {stderr[:200]}")
                success = False
        
        return success
    
    def view_logs(self, bot_name: str, lines: int = 50) -> None:
        """Просматривает логи бота"""
        print_header(f"Логи {bot_name} бота")
        
        if not self.flyctl_available:
            print_error("flyctl не установлен")
            return
        
        if bot_name not in self.BOTS:
            print_error(f"Неизвестный бот: {bot_name}")
            return
        
        app_name = self.BOTS[bot_name]['app']
        
        print_info(f"Получаю последние {lines} строк логов...")
        
        code, stdout, stderr = self._run_command(
            ['flyctl', 'logs', '--app', app_name, '-n', str(lines)],
            check=False,
            capture=True
        )
        
        if code == 0:
            print(stdout)
        else:
            print_error(f"Не удалось получить логи: {stderr}")
    
    def restart(self, bot_name: Optional[str] = None) -> bool:
        """Перезапускает бота(ов)"""
        print_header("Перезапуск ботов")
        
        if not self.flyctl_available:
            print_error("flyctl не установлен")
            return False
        
        bots_to_restart = [bot_name] if bot_name else self.BOTS.keys()
        success = True
        
        for bot_key in bots_to_restart:
            if bot_key not in self.BOTS:
                print_warning(f"Неизвестный бот: {bot_key}")
                continue
            
            app_name = self.BOTS[bot_key]['app']
            
            print_info(f"Перезапускаю {bot_key} бот...")
            
            code, stdout, stderr = self._run_command(
                ['flyctl', 'apps', 'restart', app_name],
                check=False,
                capture=True
            )
            
            if code == 0:
                print_success(f"{bot_key} бот перезапущен")
            else:
                print_error(f"Ошибка при перезапуске {bot_key} бота")
                if stderr:
                    print_error(f"Детали: {stderr[:200]}")
                success = False
        
        return success
    
    def check_health(self) -> Dict:
        """Проверяет здоровье всех сервисов"""
        print_header("Проверка здоровья сервисов")
        
        health = {
            'timestamp': datetime.now().isoformat(),
            'bots': {},
            'flyctl': self.flyctl_available
        }
        
        # Проверяем статус ботов
        status = self.check_status()
        health['bots'] = status
        
        # Проверяем локальные файлы
        health['files'] = {}
        for bot_key, bot_info in self.BOTS.items():
            config_path = self.project_root / bot_info['config']
            script_path = self.project_root / bot_info['script']
            
            health['files'][bot_key] = {
                'config_exists': config_path.exists(),
                'script_exists': script_path.exists()
            }
        
        # Выводим сводку
        print("\n📊 Сводка:")
        print(f"  Fly.io CLI: {'✅' if health['flyctl'] else '❌'}")
        
        for bot_key, bot_status in health['bots'].items():
            status_icon = '✅' if bot_status.get('status') == 'running' else '❌'
            print(f"  {bot_key} бот: {status_icon} {bot_status.get('status', 'unknown')}")
        
        return health
    
    def monitor(self, interval: int = 60, duration: int = 300) -> None:
        """Мониторит статус ботов с заданным интервалом"""
        print_header(f"Мониторинг ботов (интервал: {interval}с, длительность: {duration}с)")
        
        start_time = time.time()
        iteration = 0
        
        try:
            while time.time() - start_time < duration:
                iteration += 1
                print(f"\n{Colors.CYAN}[{datetime.now().strftime('%H:%M:%S')}] Итерация {iteration}{Colors.RESET}")
                
                status = self.check_status()
                
                # Проверяем, все ли боты работают
                all_running = all(
                    s.get('status') == 'running' 
                    for s in status.values()
                )
                
                if not all_running:
                    print_warning("Некоторые боты не работают!")
                
                if time.time() - start_time < duration:
                    print_info(f"Следующая проверка через {interval} секунд...")
                    time.sleep(interval)
        
        except KeyboardInterrupt:
            print("\n\nМониторинг остановлен пользователем")
    
    def setup_secrets(self, bot_name: Optional[str] = None, env_file: str = '.env') -> bool:
        """Устанавливает секреты из .env файла"""
        print_header("Установка секретов")
        
        if not self.flyctl_available:
            print_error("flyctl не установлен")
            return False
        
        env_path = self.project_root / env_file
        if not env_path.exists():
            print_error(f"Файл {env_file} не найден")
            return False
        
        # Читаем .env файл
        secrets = {}
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    secrets[key.strip()] = value.strip()
        
        if not secrets:
            print_warning("Секреты не найдены в .env файле")
            return False
        
        bots_to_setup = [bot_name] if bot_name else self.BOTS.keys()
        success = True
        
        for bot_key in bots_to_setup:
            if bot_key not in self.BOTS:
                print_warning(f"Неизвестный бот: {bot_key}")
                continue
            
            app_name = self.BOTS[bot_key]['app']
            print_info(f"Устанавливаю секреты для {bot_key} бота...")
            
            # Формируем команду для установки секретов
            secret_args = []
            for key, value in secrets.items():
                secret_args.append(f"{key}={value}")
            
            # Fly.io требует формат KEY=VALUE для каждого секрета
            cmd = ['flyctl', 'secrets', 'set', '--app', app_name] + secret_args
            
            code, stdout, stderr = self._run_command(
                cmd,
                check=False,
                capture=True
            )
            
            if code == 0:
                print_success(f"Секреты для {bot_key} бота установлены")
            else:
                print_error(f"Ошибка при установке секретов для {bot_key} бота")
                if stderr:
                    print_error(f"Детали: {stderr[:200]}")
                success = False
        
        return success
    
    def show_info(self) -> None:
        """Показывает информацию о проекте"""
        print_header("Информация о проекте")
        
        print(f"{Colors.BOLD}Боты:{Colors.RESET}")
        for bot_key, bot_info in self.BOTS.items():
            print(f"  • {bot_key}: {bot_info['app']} ({bot_info['script']})")
        
        print(f"\n{Colors.BOLD}Конфигурации:{Colors.RESET}")
        for bot_key, bot_info in self.BOTS.items():
            config_path = self.project_root / bot_info['config']
            exists = "✅" if config_path.exists() else "❌"
            print(f"  • {bot_info['config']}: {exists}")
        
        print(f"\n{Colors.BOLD}Инструменты:{Colors.RESET}")
        print(f"  • Fly.io CLI: {'✅' if self.flyctl_available else '❌'}")
        
        # Проверяем наличие скриптов
        scripts = ['admin_bot.py', 'bot.py', 'client_handler.py']
        print(f"\n{Colors.BOLD}Скрипты ботов:{Colors.RESET}")
        for script in scripts:
            script_path = self.project_root / script
            exists = "✅" if script_path.exists() else "❌"
            print(f"  • {script}: {exists}")


def main():
    parser = argparse.ArgumentParser(
        description='DevOps Agent для управления LoyalityBot',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры использования:
  %(prog)s status                    # Проверить статус всех ботов
  %(prog)s status --bot admin        # Проверить статус админ-бота
  %(prog)s deploy                    # Задеплоить все боты
  %(prog)s deploy --bot partner     # Задеплоить партнерского бота
  %(prog)s logs admin --lines 100   # Показать логи админ-бота
  %(prog)s restart                   # Перезапустить все боты
  %(prog)s health                    # Проверить здоровье сервисов
  %(prog)s monitor                   # Мониторить статус ботов
  %(prog)s secrets                   # Установить секреты из .env
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Команда для выполнения')
    
    # Команда status
    status_parser = subparsers.add_parser('status', help='Проверить статус ботов')
    status_parser.add_argument('--bot', choices=['admin', 'partner', 'client'], help='Конкретный бот')
    
    # Команда deploy
    deploy_parser = subparsers.add_parser('deploy', help='Задеплоить ботов')
    deploy_parser.add_argument('--bot', choices=['admin', 'partner', 'client'], help='Конкретный бот')
    deploy_parser.add_argument('--no-remote', action='store_true', help='Локальная сборка')
    
    # Команда logs
    logs_parser = subparsers.add_parser('logs', help='Просмотреть логи бота')
    logs_parser.add_argument('bot', choices=['admin', 'partner', 'client'], help='Бот для просмотра логов')
    logs_parser.add_argument('--lines', type=int, default=50, help='Количество строк (по умолчанию: 50)')
    
    # Команда restart
    restart_parser = subparsers.add_parser('restart', help='Перезапустить ботов')
    restart_parser.add_argument('--bot', choices=['admin', 'partner', 'client'], help='Конкретный бот')
    
    # Команда health
    subparsers.add_parser('health', help='Проверить здоровье сервисов')
    
    # Команда monitor
    monitor_parser = subparsers.add_parser('monitor', help='Мониторить статус ботов')
    monitor_parser.add_argument('--interval', type=int, default=60, help='Интервал проверки в секундах (по умолчанию: 60)')
    monitor_parser.add_argument('--duration', type=int, default=300, help='Длительность мониторинга в секундах (по умолчанию: 300)')
    
    # Команда secrets
    secrets_parser = subparsers.add_parser('secrets', help='Установить секреты из .env файла')
    secrets_parser.add_argument('--bot', choices=['admin', 'partner', 'client'], help='Конкретный бот')
    secrets_parser.add_argument('--env', default='.env', help='Файл с переменными окружения (по умолчанию: .env)')
    
    # Команда info
    subparsers.add_parser('info', help='Показать информацию о проекте')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    agent = DevOpsAgent()
    
    try:
        if args.command == 'status':
            agent.check_status(args.bot)
        elif args.command == 'deploy':
            agent.deploy(args.bot, remote_only=not args.no_remote)
        elif args.command == 'logs':
            agent.view_logs(args.bot, args.lines)
        elif args.command == 'restart':
            agent.restart(args.bot)
        elif args.command == 'health':
            agent.check_health()
        elif args.command == 'monitor':
            agent.monitor(args.interval, args.duration)
        elif args.command == 'secrets':
            agent.setup_secrets(args.bot, args.env)
        elif args.command == 'info':
            agent.show_info()
    except KeyboardInterrupt:
        print("\n\nОперация прервана пользователем")
        sys.exit(1)
    except Exception as e:
        print_error(f"Неожиданная ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()




