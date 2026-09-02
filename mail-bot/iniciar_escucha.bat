@echo off
REM NO EN USO — se optó por Programador de tareas cada 2hs en vez del
REM watcher continuo. Ver README, seccion 6. Se deja por si se quiere
REM volver a este modelo.
REM
REM Doble-click para que el botón "Revisar correo ahora" del panel
REM funcione. Dejá esta ventana abierta (se puede minimizar) mientras
REM estés conectado a la VPN/red interna — corta con Ctrl+C o cerrando
REM la ventana cuando no haga falta más.

cd /d "%~dp0"

if not exist ".env" (
    echo Falta mail-bot\.env — copia .env.example a .env y completa los valores.
    pause
    exit /b 1
)

echo Verificando dependencias...
python -m pip install -q -r requirements.txt

python watcher.py

pause
