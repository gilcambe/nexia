@echo off
chcp 65001 >nul
title Ligar Facebook e Instagram do robo NEXIA
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0configurar-meta.ps1"
