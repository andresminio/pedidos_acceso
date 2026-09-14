@echo off
REM Doble-click para revisar el correo ahora. Requiere estar conectado
REM a la VPN/red interna del organismo, y tener mail-bot\.env completo
REM (copiá .env.example a .env una sola vez y completá los valores).

cd /d "%~dp0"

set LOG=log.txt
echo. >> "%LOG%"
echo ===== %date% %time% ===== >> "%LOG%"

if not exist ".env" (
    echo Falta mail-bot\.env — copia .env.example a .env y completa los valores.
    echo Falta mail-bot\.env >> "%LOG%"
    timeout /t 15
    exit /b 1
)

echo Verificando dependencias...
python -m pip install -q -r requirements.txt >> "%LOG%" 2>&1

python main.py >> "%LOG%" 2>&1

echo.
echo Listo. Revisa /revision en el panel para ver los candidatos nuevos.
echo Fin de la corrida. >> "%LOG%"
REM timeout en vez de pause: corrido por el Programador de tareas (sin
REM nadie que apriete una tecla) un "pause" se queda colgado para
REM siempre y bloquea todas las corridas siguientes. Con timeout se
REM cierra solo — si lo corriste a mano con doble-click, igual tenés
REM unos segundos para leer el mensaje antes de que se cierre.
timeout /t 5
