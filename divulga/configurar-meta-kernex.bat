@echo off
chcp 65001 >nul
title Ligar Facebook e Instagram da KERNEX
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0configurar-meta.ps1" -Perfil kernex
