# 🤖 P2P Arbitrage Bot — Integrado en chain-event-indexer

Módulo de monitoreo de arbitraje P2P en tiempo real con **alertas de ciclo de vida completo (Apertura, Expansión y Cierre)**, **formato cronológico estricto de pasos**, **botón interactivo de ejecución en Telegram**, **almacenamiento de tasas por bloque en Cloudflare D1** y **filtrado por monto real en Binance P2P**, integrado directamente dentro de **`@chain-event-indexer`** (`src/arbitrage-bot/`).

---

## 📌 Funcionalidades Principales

1. **Formato Cronológico Estricto en Telegram (1️⃣ Paso 1 ➡️ 2️⃣ Paso 2):**  
   Todas las notificaciones muestran las tasas en el orden exacto de ejecución según la ruta:
   * **Lado 1:** 1️⃣ Compras USDC en Contrato ➡️ 2️⃣ Vendes USDC en Binance P2P.
   * **Lado 2:** 1️⃣ Vendes USDC en Contrato ➡️ 2️⃣ Recompras USDC en Binance P2P.

2. **Filtrado Dinámico por Monto en FIAT (`transAmount`) en Binance P2P:**  
   Binance API recibe el filtro `transAmount` ajustado al tamaño real de tu operación ($250 USDC $\approx$ `215,000 VES`), descartando comerciantes sin cupo o límites adecuados.

3. **Filtro de Ventana de Pago Rápida (`periods: [15]`):**  
   Al vender en Binance P2P se exige la ventana de pago de 15 minutos para garantizar la recarga inmediata de PagoMóvil.

4. **Historial Completo por Bloque en Cloudflare D1 (`block_prices`):**  
   Migración `0005` aplicada. En cada bloque se registran simultáneamente:
   * `buy_price` y `sell_price` (Contrato Smart Diamond)
   * `binance_buy_price` y `binance_sell_price` (Binance P2P API)

5. **Ciclo de Vida Completo de Notificaciones:**
   * 🟢 **Apertura:** Alerta al cruzar el umbral (`> 1.0%`).
   * 📈 **Expansión de Margen:** Re-alerta si la ganancia sube $+0.5\%$ o más mientras la oportunidad sigue abierta.
   * 🛑 **Cierre de Oportunidad:** Alerta indicando el bloque exacto de cierre y el tiempo total que duró abierta la brecha.

6. **Módulo Ejecutor Dedicado (`src/arbitrage-bot/executor/trade-executor.ts`):**  
   Archivo desacoplado y preparado para conectar tu Llave Privada / Wallet Client (viem) y la interacción real con el smart contract a futuro.

7. **Comando `/saldos` en Telegram:**  
   Consulta en tiempo real los saldos de USDC y ETH del **Top 5 Billeteras Competidoras y sus Billeteras Intermedias CEX**.

---

## 📊 Análisis de Episodios Individuales de Brecha

El script **`src/investigation/scripts/analyze-gap-episodes.ts`** permite agrupar los bloques de D1 en episodios individuales e identificar los momentos exactos de crecimiento:

* **Duración Promedio de la Brecha:** ~5.6 minutos (333 segundos / 168 bloques).
* **Momento de Primer Incremento:** El primer pinto relevante de margen suele ocurrir **entre los 3.5 y 4.0 minutos** tras la apertura.
* **Momento de Segundo Incremento:** Brechas largas (24 min) experimentan su segundo pico de expansión alrededor del **minuto 16.0**.

---

## 🚀 Cómo Ejecutar el Bot e Indexador

```bash
# Opción 1: Iniciar todo el Indexer + Bot integrado + Telegram (Recomendado)
pnpm --filter @chain-event-indexer dev

# Opción 2: Analizar episodios individuales de brechas almacenados en D1
npx tsx src/investigation/scripts/analyze-gap-episodes.ts

# Opción 3: Simulación retrospectiva de ganancias
npx tsx src/investigation/scripts/simular-oportunidades-del-dia.ts
```
