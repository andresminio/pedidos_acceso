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

echo Verificando dependencias...
python -m pip install -q -r requirements.txt

python main.py

echo.
echo Listo. Revisa /revision en el panel para ver los candidatos nuevos.
pause
