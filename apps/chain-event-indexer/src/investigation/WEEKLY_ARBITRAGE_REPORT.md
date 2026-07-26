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
   * **Ruta On-Chain:** Transfiere USDC a la red de hot wallets de Binance.

3. **`0x5135455a8dac41481efff3c5a0b3a559f2db8925`**
   * **Volumen Semanal:** **$8,431.80 USDC** (39 órdenes | 35 completadas | 10.3% cancelaciones).
   * **Promedio por Orden:** $240.91 USDC.
   * **Horarios Pico (UTC):** `12:00 UTC` (14 ops), `13:00 UTC` (10 ops).

4. **`0x717bdd1b8f4dc0661b20e07843236e08baff4e18`**
   * **Volumen Semanal:** **$8,353.61 USDC** (40 órdenes | 30 completadas).
   * **Horarios Pico (UTC):** `16:00 UTC` (12 ops), `17:00 UTC` (9 ops).

5. **`0x58903b37754acb59b686e97d94409d68375ac2d2` (Whale Analizada)**
   * **Volumen Semanal:** **$5,750.00 USDC** (33 órdenes | 29 completadas).
   * **Horarios Pico (UTC):** `20:00 UTC` (11 ops), `21:00 UTC` (8 ops).
   * **Ruta On-Chain:** $5,750 USDC en ráfagas exactas de $250 USDC cada 4 minutos $\rightarrow$ Billetera de salto `0xC263...8de` $\rightarrow$ **Binance Hot Wallet 2**.

---

### 🔴 Lado 2: Vendedores masivos en el Contrato (Inyección desde Binance)

1. **`0x0674a4d3699a2222b98fd554f308c3f064b6fcee`**
   * **Volumen Semanal:** **$6,860.18 USDC** ($3,000 Compras / $3,860.18 Ventas).
   * **Horarios Pico (UTC):** `11:00 UTC` (8 ops), `16:00 UTC` (6 ops).
   * **Ruta On-Chain:** **Retira fondos directamente desde Binance Hot Wallet 2 (`0xEe7a...055`)** a su wallet en Base Mainnet y vende USDC en el contrato Diamond a tasa inflada.

2. **`0x618a03e93f061a777700afc38b94beba063dff13`**
   * **Volumen Semanal:** **$1,017.90 USDC** (14 operaciones de venta completadas).
   * **Ruta On-Chain:** Billetera receptora de retiros CEX $\rightarrow$ Inyección al contrato P2P.

---

## 🧭 3. Mapa de Rutas On-Chain (Money Trail)

### Diagrama del Flujo Lado 1 (Extracción):
```text
[ Contrato Diamond P2P ]
       │  (Compra USDC barato a tasa desfasada)
       ▼
[ Billetera del Arbitrador ]  (Ej: 0xaf44... / 0x5890...)
       │  (Transferencia ERC20 USDC)
       ▼
[ Billetera Intermediaria / Hop ]  (Ej: 0xC26375024AF88D9288Bea15791f136b9640de8de)
       │  (Depósito CEX)
       ▼
[ BINANCE HOT WALLET 2 ]  (0xEe7aE85f2Fe2239E27D9c1E23fFFe168D63b4055)
       │  (Comercio P2P C2C)
       ▼
[ PagoMovil Fiat VES ]
```

---

## 💰 4. Análisis de Saldos en Vivo y Estrategia Just-In-Time

* **Saldos Retenidos On-Chain:** Se identificaron billeteras como `0x54fe...0522` reteniendo **$5,250.00 USDC** y `0xfe4e...b774` con **$1,008.98 USDC** listos para operar.
* **Patrón Just-in-Time:** La mayoría de los operadores mantienen saldos residuales ($30-$50 USDC) y transfieren USDC desde Binance justo en el segundo en que se detecta la apertura de la oportunidad.
* **Monitoreo en Telegram:** El comando `/saldos` consulta en vivo los saldos USDC/ETH del Top 5 Billeteras + Intermedias CEX.

---

## 🤖 5. Red de Bots Exploradores (Sondeo de Latencia)

Se identificaron **28 billeteras automáticas** diseñadas para detectar el desfase de tasa entre Binance P2P y el contrato Diamond:

* **Bot Principal (`0x0776852ef593cabd26ae43765f22179e89c41178`):**
  * **297 cancelaciones de 299 órdenes** (99.3% de tasa de cancelación).
  * Envía órdenes simbólicas de **$0.50 USDC**. Si la tasa es favorable y el contrato responde rápido, cancela e informa a la cuenta Whale principal para ejecutar ráfagas de $250 USDC.

---

## 🕒 6. Distribución de Horarios de Mayor Actividad (UTC vs Venezuela)

| Franja Horaria (UTC) | Hora Venezuela (VET) | Nivel de Actividad | Descripción |
|----------------------|----------------------|-------------------|-------------|
| **12:00 - 16:00 UTC** | **08:00 - 12:00 VET** | 🔥 **Muy Alto (Pico Mañana)** | Concentración del Top 5 de compradores. |
| **16:00 - 20:00 UTC** | **12:00 - 16:00 VET** | 🔥 **Muy Alto (Pico Tarde)** | Operaciones masivas de ráfagas Whale ($250 USDC). |
| **20:00 - 00:00 UTC** | **16:00 - 20:00 VET** | ⚡ **Moderado-Alto** | Ajustes de tasa nocturnos y cierres de sesión. |
| **00:00 - 08:00 UTC** | **20:00 - 04:00 VET** | 💤 **Bajo** | Baja liquidez y menor volumen de órdenes. |

---

## ⏱️ 7. Medición Empírica de la Duración de las Brechas

* ⏱️ **Tiempo Promedio de Duración de Tasa:** **335.0 segundos (~5.58 minutos)**.
* 📦 **Bloques Promedio entre Ajustes:** **168 bloques** en Base Mainnet.
* ⚡ **Frecuencia en Alta Volatilidad:** **Cada 120 segundos (~2.0 minutos / 60 bloques)**.

### Implicación Estratégica:
La ventana de oportunidad para ejecutar una orden permanece abierta durante **60 a 150 bloques (2 a 5 minutos)**. Este margen de tiempo permite a las cuentas Whale ejecutar ráfagas de 3 a 5 órdenes consecutivas de **$250 USDC**.

---

## 🛠️ 8. Arquitectura del Bot de Arbitraje Integrado y Módulo Ejecutor

* **Módulo Ejecutor Dedicado:** `src/arbitrage-bot/executor/trade-executor.ts`
* **Botón Interactivo Inline:** Las alertas incluyen el botón `[ ⚡ EJECUTAR COMPRA ($250 USDC) ]`.
* **Notificaciones Telegram:**
  1. 🟢 `Oportunidad Abierta` (Margen $\ge 1.0\%$)
  2. 📈 `Expansión de Margen` (Re-alerta al subir $+0.5\%$ adicional)
  3. 🛑 `Cierre de Oportunidad` (Informando bloques y tiempo de apertura)
