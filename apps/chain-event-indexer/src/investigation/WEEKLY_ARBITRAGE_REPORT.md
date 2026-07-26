# 📊 INFORME COMPLETO DE ARBITRAJE P2P — SEMANA DEL 19 AL 26 DE JULIO DE 2026

Este informe documenta de forma exhaustiva la actividad de comercio y arbitraje en el contrato inteligente Diamond (`0x4cad...368`) en **Base Mainnet** durante la semana del **19 al 26 de Julio de 2026**.

---

## 📌 1. Resumen Ejecutivo y Métricas Globales

* **Total de Órdenes Procesadas:** `12,099` órdenes en los últimos 7 días.
* **Volumen Total Procesado:** `$8,556,832.56 USDC` en la base de datos histórica.
* **Billeteras Únicas Activas Esta Semana:** `2,700` direcciones de usuario.
* **Red de Bots Exploradores Identificados:** `28` billeteras automáticas (>80% de tasa de cancelación).
* **Destino Principal del Dinero Extraído:** **Binance Hot Wallet 2 (`0xEe7aE85f2Fe2239E27D9c1E23fFFe168D63b4055`)**.

---

## 🏆 2. Top Billeteras Operadoras y Horarios Pico de Operación

A continuación se detalla el comportamiento de las principales billeteras operadoras, su volumen, dirección de comercio y **los horarios en los que concentran su actividad**:

### 🟢 Lado 1: Compradores masivos en el Contrato (Extracción hacia Binance)

1. **`0xaf446ee1254e550357a0c0e28b0332cfebe4a3b8`**
   * **Volumen Semanal:** **$12,213.47 USDC** (65 órdenes | 53 completadas | 18.5% cancelaciones).
   * **Promedio por Orden:** $230.44 USDC.
   * **Horarios Pico (UTC):** `14:00 UTC` (18 ops), `15:00 UTC` (12 ops), `16:00 UTC` (9 ops). *(Tarde / Noche Venezuela)*.
   * **Ruta On-Chain:** Envía fondos a billetera intermedia `0xC263...8de` $\rightarrow$ Deposita directamente en **Binance Hot Wallet 2 (`0xEe7a...055`)**.

2. **`0xd84071611ab295254c16ada737d8634980c73e51`**
   * **Volumen Semanal:** **$12,049.84 USDC** (62 órdenes | 40 completadas | 35.5% cancelaciones).
   * **Promedio por Orden:** $301.25 USDC.
   * **Horarios Pico (UTC):** `18:00 UTC` (15 ops), `19:00 UTC` (11 ops), `20:00 UTC` (8 ops).

3. **`0x58903b37754acb59b686e97d94409d68375ac2d2` (Whale Analizada)**
   * **Volumen Semanal:** **$5,750.00 USDC** (33 órdenes | 29 completadas).
   * **Ruta On-Chain:** $5,750 USDC en ráfagas exactas de $250 USDC cada 4 minutos $\rightarrow$ Billetera de salto `0xC263...8de` $\rightarrow$ **Binance Hot Wallet 2**.

---

## 💰 3. Análisis de Saldos en Vivo y Estrategia Just-In-Time

* **Saldos Retenidos On-Chain:** Se identificaron billeteras como `0x54fe...0522` reteniendo **$5,250.00 USDC** y `0xfe4e...b774` con **$1,008.98 USDC** listos para operar.
* **Patrón Just-in-Time:** La mayoría de los operadores mantienen saldos residuales ($30-$50 USDC) y transfieren USDC desde Binance justo en el segundo en que se detecta la apertura de la oportunidad.
* **Monitoreo en Telegram:** El comando `/saldos` consulta en vivo los saldos USDC/ETH del Top 5 Billeteras + Intermedias CEX.

---

## ⏱️ 4. Medición Empírica y Momentos de Crecimiento de las Brechas

Análisis realizado con `src/investigation/scripts/analyze-gap-episodes.ts`:

* ⏱️ **Duración Promedio por Brecha:** **333.3 segundos (~5.6 minutos / 168 bloques)**.
* 📈 **Momento del Primer Incremento:** El primer pico importante de margen ocurre entre los **3.5 y 4.0 minutos** tras la apertura de la brecha.
* 📈 **Momento del Segundo Incremento:** En brechas extensas (24 min), el segundo pico de expansión ocurre cerca del **minuto 16.0** (ej. expansión de +0.38% a +1.65%).

---

## 🛠️ 5. Arquitectura del Bot, D1 y Ejecución en Telegram

* **Formato Cronológico en Telegram:** 1️⃣ Paso 1 (Plataforma 1) ➡️ 2️⃣ Paso 2 (Plataforma 2).
* **Filtrado por Monto en FIAT (`transAmount`):** Ajustado a $250 USDC ($\approx$ `215,000 VES`).
* **Ventana de Cobro Rápido (`periods: [15]`):** Filtrado de 15 minutos al vender en Binance P2P.
* **Historial Completo en D1 (`block_prices`):** Almacena `buy_price`, `sell_price`, `binance_buy_price` y `binance_sell_price` por bloque.
* **Módulo Ejecutor Dedicado:** `src/arbitrage-bot/executor/trade-executor.ts` preparado para conectar firma EOA y smart contract a futuro.
