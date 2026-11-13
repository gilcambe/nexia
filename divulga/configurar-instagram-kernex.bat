@echo off
chcp 65001 >nul
title Ligar o Instagram da KERNEX
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0configurar-instagram-kernex.ps1"
