# 🤖 P2P Arbitrage Bot — Integrado en chain-event-indexer

Módulo de monitoreo de arbitraje P2P en tiempo real con **alertas de ciclo de vida completo (Apertura, Expansión y Cierre)**, **botón interactivo de ejecución en Telegram**, **control de fallos de la API de Binance** y **almacenamiento en Cloudflare D1**, integrado directamente dentro de **`@chain-event-indexer`** (`src/arbitrage-bot/`).

---

## 📌 ¿Cómo funciona el Bot Integrado?

1. **Reutilización Total en Memoria (0 RPCs Extra):**  
   Cuando el indexer (`src/server/index.ts`) consulta el precio del contrato Diamond en Base Mainnet para la base de datos D1, le pasa inmediatamente los precios en memoria al bot.
   * **0 llamadas HTTP RPC adicionales a la blockchain.**
   * **0 lecturas extra a D1.**

2. **Control de Fallos de la API de Binance P2P:**
   * Si la API de Binance cae, responde con error HTTP o bloquea peticiones, tras 3 intentos consecutivos te enviará una alerta de advertencia a Telegram:  
     `⚠️ ¡ALERTA: LA API DE BINANCE P2P NO ESTÁ RESPONDIENDO!`
   * En cuanto la API de Binance se recupera, te envía la notificación de restablecimiento:  
     `✅ LA API DE BINANCE P2P SE HA RESTABLECIDO`

3. **Ciclo de Vida Completo de Notificaciones en Telegram:**
   * 🟢 **Apertura:** Alerta en verde al cruzar el umbral (`> 1.0%`).
   * 📈 **Expansión de Margen:** Re-alerta si la ganancia sube $+0.5\%$ o más mientras la oportunidad sigue abierta.
   * 🛑 **Cierre de Oportunidad:** Alerta en rojo indicando el bloque exacto de cierre y el tiempo total que duró abierta la brecha (segundos y bloques).

4. **Botón Interactivo de Ejecución en Telegram:**  
   Cada alerta de apertura o expansión incluye un botón inline `[ ⚡ EJECUTAR COMPRA ($250 USDC) ]` que invoca el ejecutor en `src/arbitrage-bot/executor/trade-executor.ts`.

5. **Comando `/saldos` en Telegram:**  
   Consulta en tiempo real los saldos de USDC y ETH en Base Mainnet del **Top 5 Billeteras Competidoras y sus Billeteras Intermedias CEX**.

6. **Persistencia de Oportunidades en Cloudflare D1:**  
   Cada oportunidad se registra automáticamente en la tabla `arbitrage_opportunities` en formato decimal humano (`real`).

---

## ⏱️ Duración Empírica de las Brechas de Oportunidad

Mediciones empíricas almacenadas en D1:

| Métrica | Valor Empírico Medido |
|---------|-----------------------|
| ⏱️ **Tiempo Promedio de Duración de Tasa:** | **335 segundos (~5.58 minutos)** |
| 📦 **Bloques Promedio entre Ajustes de Tasa:** | **168 bloques** (~2s por bloque en Base Mainnet) |
| ⚡ **Frecuencia en Alta Volatilidad:** | **Cada 120 segundos (~2.0 minutos / 60 bloques)** |

---

## 🚀 Cómo Ejecutar el Bot Integrado

```bash
# Opción 1: Iniciar todo el Indexer + Bot integrado + Telegram (Recomendado)
pnpm --filter @chain-event-indexer dev

# Opción 2: Iniciar solo el Bot en modo autónomo desde chain-event-indexer
pnpm --filter @chain-event-indexer bot
```
