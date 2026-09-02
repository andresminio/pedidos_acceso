@echo off
REM Doble-click para revisar el correo ahora. Requiere estar conectado
REM a la VPN/red interna del organismo, y tener mail-bot\.env completo
REM (copiá .env.example a .env una sola vez y completá los valores).

cd /d "%~dp0"

if not exist ".env" (
    echo Falta mail-bot\.env — copia .env.example a .env y completa los valores.
    pause
    exit /b 1
)

python -m pip show python-dotenv >nul 2>&1
if errorlevel 1 (
    echo Instalando dependencias por primera vez...
    python -m pip install -r requirements.txt
)

python main.py

echo.
echo Listo. Revisa /revision en el panel para ver los candidatos nuevos.
pause
