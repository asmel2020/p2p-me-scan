# 🤖 P2P Arbitrage Bot — Integrado en chain-event-indexer

Módulo de monitoreo de arbitraje P2P en tiempo real integrado directamente dentro de **`@chain-event-indexer`** (`src/arbitrage-bot/`).

---

## 📌 ¿Cómo funciona el Bot Integrado?

1. **Reutilización Total en Memoria (0 RPCs Extra):**  
   Cuando el indexer (`src/server/index.ts`) consulta el precio del contrato Diamond en Base Mainnet para la base de datos D1, le pasa inmediatamente los precios en memoria al bot.
   * **0 llamadas HTTP RPC adicionales a la blockchain.**
   * **0 lecturas extra a D1.**

2. **Chequeo Bidireccional en Tiempo Real (Dos Lados):**
   * **Lado 1:** Comprar en Contrato Diamond P2P $\rightarrow$ Vender en Binance P2P por PagoMovil.
   * **Lado 2:** Comprar en Binance P2P por PagoMovil $\rightarrow$ Vender en Contrato Diamond P2P.

3. **Notificaciones Automáticas a Telegram:**  
   Cuando la ganancia neta supera el umbral (`> 1.0%` o el configurado en `.env`), envía una alerta instantánea en formato HTML con la ganancia proyectada en USD.

4. **Persistencia de Oportunidades en Cloudflare D1:**  
   Cada oportunidad se registra automáticamente en la tabla `arbitrage_opportunities` en formato humano (tasas decimales divididas entre $10^6$).

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
# Opción 1: Iniciar todo el Indexer + Bot integrado (Recomendado)
pnpm --filter @chain-event-indexer dev

# Opción 2: Iniciar solo el Bot en modo autónomo desde chain-event-indexer
pnpm --filter @chain-event-indexer bot
```
