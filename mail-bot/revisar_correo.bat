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

REM OJO: nunca poner parentesis "(" ")" sueltos en un echo dentro de un
REM bloque if (...) - cmd.exe los toma como el cierre del bloque y rompe
REM el parseo silenciosamente. Por eso el mensaje de abajo no los usa.
if "%BWS_ACCESS_TOKEN%"=="" (
    echo Falta la variable de entorno BWS_ACCESS_TOKEN - token de Bitwarden Secrets Manager.
    echo Falta BWS_ACCESS_TOKEN en esta sesion/cuenta de Windows. >> "%LOG%"
    timeout /t 15
    exit /b 1
)

echo BWS_ACCESS_TOKEN detectado, se sigue con la corrida. >> "%LOG%"

echo Verificando dependencias...
echo --- pip install --- >> "%LOG%"
python -m pip install -q -r requirements.txt >> "%LOG%" 2>&1
echo pip install termino con errorlevel %errorlevel% >> "%LOG%"

echo --- python main.py --- >> "%LOG%"
python main.py >> "%LOG%" 2>&1
echo main.py termino con errorlevel %errorlevel% >> "%LOG%"

echo.
echo Listo. Revisa /revision en el panel para ver los candidatos nuevos.
echo Fin de la corrida. >> "%LOG%"
REM timeout en vez de pause: corrido por el Programador de tareas (sin
REM nadie que apriete una tecla) un "pause" se queda colgado para
REM siempre y bloquea todas las corridas siguientes. Con timeout se
REM cierra solo — si lo corriste a mano con doble-click, igual tenés
REM unos segundos para leer el mensaje antes de que se cierre.
timeout /t 5
