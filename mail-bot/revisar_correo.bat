@echo off
REM Doble-click para revisar el correo ahora. Requiere estar conectado
REM a la VPN/red interna del organismo, y tener seteada la variable de
REM entorno BWS_ACCESS_TOKEN (cuenta de maquina de Bitwarden Secrets
REM Manager con acceso al proyecto marybot). Las credenciales ya NO se
REM leen de un .env local, se traen de Bitwarden en main.py.

cd /d "%~dp0"

set LOG=log.txt
echo. >> "%LOG%"
echo ===== %date% %time% ===== >> "%LOG%"

if "%BWS_ACCESS_TOKEN%"=="" (
    echo Falta la variable de entorno BWS_ACCESS_TOKEN (token de Bitwarden Secrets Manager).
    echo Falta BWS_ACCESS_TOKEN >> "%LOG%"
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
