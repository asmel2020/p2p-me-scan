# 🤖 P2P Arbitrage Bot — Integrado en chain-event-indexer

Módulo de monitoreo de arbitraje P2P en tiempo real con **alertas de ciclo de vida completo (Apertura, Expansión y Cierre)**, **botón interactivo de ejecución en Telegram** y **almacenamiento en Cloudflare D1**, integrado directamente dentro de **`@chain-event-indexer`** (`src/arbitrage-bot/`).

---

## 📌 ¿Cómo funciona el Bot Integrado?

1. **Reutilización Total en Memoria (0 RPCs Extra):**  
   Cuando el indexer (`src/server/index.ts`) consulta el precio del contrato Diamond en Base Mainnet para la base de datos D1, le pasa inmediatamente los precios en memoria al bot.
   * **0 llamadas HTTP RPC adicionales a la blockchain.**
   * **0 lecturas extra a D1.**

2. **Chequeo Bidireccional en Tiempo Real (Dos Lados):**
   * **Lado 1:** Comprar en Contrato Diamond P2P $\rightarrow$ Vender en Binance P2P por PagoMovil.
   * **Lado 2:** Comprar en Binance P2P por PagoMovil $\rightarrow$ Vender en Contrato Diamond P2P.

3. **Ciclo de Vida Completo de Notificaciones en Telegram:**
   * 🟢 **Apertura:** Alerta en verde al cruzar el umbral (`> 1.0%`).
   * 📈 **Expansión de Margen:** Re-alerta si la ganancia sube $+0.5\%$ o más mientras la oportunidad sigue abierta.
   * 🛑 **Cierre de Oportunidad:** Alerta en rojo indicando el bloque exacto de cierre y el tiempo total que duró abierta la brecha (segundos y bloques).

4. **Botón Interactivo de Ejecución en Telegram:**  
   Cada alerta de apertura o expansión incluye un botón inline `[ ⚡ EJECUTAR COMPRA ($250 USDC) ]` que invoca la función simulada en el ejecutor dedicado.

5. **Módulo Ejecutor Dedicado (`src/arbitrage-bot/executor/trade-executor.ts`):**  
   Archivo desacoplado y preparado estructuralmente para conectar tu Llave Privada / Wallet Client (viem) y la interacción real con el smart contract a futuro.

6. **Comando `/saldos` en Telegram:**  
   Consulta en tiempo real los saldos de USDC y ETH en Base Mainnet del **Top 5 Billeteras Competidoras y sus Billeteras Intermedias CEX**.

7. **Persistencia de Oportunidades en Cloudflare D1:**  
   Cada oportunidad se registra automáticamente en la tabla `arbitrage_opportunities` en formato decimal humano (`real`).

---

## ⏱️ Duración Empírica de las Brechas de Oportunidad

Mediciones empíricas almacenadas en D1:

| Métrica | Valor Empírico Medido |
|---------|-----------------------|
| ⏱️ **Tiempo Promedio de Duración de Tasa:** | **335 segundos (~5.58 minutos)** |
| 📦 **Bloques Promedio entre Ajustes de Tasa:** | **168 bloques** (~2s por bloque en Base Mainnet) |
| ⚡ **Frecuencia en Alta Volatilidad:** | **Cada 120 segundos (~2.0 minutos / 60 bloques)** |

### 💡 Implicaciones para la Ejecución:
- **Ventana de Ejecución:** Una vez detectada la oportunidad, la brecha permanece abierta entre **60 y 150 bloques (2 a 5 minutos)**.
- **Estrategia de Ráfagas:** Los operadores masivos aprovechan estos 2 a 5 minutos para enviar entre **3 y 5 órdenes seguidas de $250 USDC** antes de que el precio sea corregido on-chain.

---

## 🚀 Cómo Ejecutar el Bot Integrado

```bash
# Opción 1: Iniciar todo el Indexer + Bot integrado + Telegram (Recomendado)
pnpm --filter @chain-event-indexer dev

# Opción 2: Iniciar solo el Bot en modo autónomo desde chain-event-indexer
pnpm --filter @chain-event-indexer bot
```
