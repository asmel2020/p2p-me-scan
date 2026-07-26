# 🤖 P2P Arbitrage Bot — Telegram Alert Monitor & D1 Persistence

Bot independiente de monitoreo de arbitraje P2P en tiempo real entre el contrato Diamond en **Base Mainnet** y el mercado **Binance P2P (VES/USDC)** con **alertas automáticas a Telegram** y **almacenamiento en Cloudflare D1**.

---

## 📌 ¿Cómo funciona el Bot?

1. **Monitoreo Silencioso (Sin Spamear la Consola):** Los logs continuos de cada bloque están silenciados (`silentConsoleLogs: true`). El bot trabaja en segundo plano sin llenar la consola.
2. **Chequeo Bidireccional (Dos Lados):**
   * **Lado 1:** Comprar en Contrato Diamond P2P $\rightarrow$ Vender en Binance P2P por PagoMovil.
   * **Lado 2:** Comprar en Binance P2P por PagoMovil $\rightarrow$ Vender en Contrato Diamond P2P.
3. **Notificación Instantánea a Telegram:** Cuando el margen neto de ganancia de cualquiera de los dos lados supera el umbral configurado (`> 1.0%`), envía un mensaje formateado a tu chat/canal de Telegram con los datos de la oportunidad y la ganancia proyectada en USD.
4. **Protección Anti-Spam (Cooldown):** Tiene un sistema de tiempo de espera (`alertCooldownMs = 30000`) de 30 segundos entre alertas para no saturar tu Telegram cuando la tasa se mantiene favorable durante varios bloques.
5. **Persistencia de Oportunidades en D1:** Cada oportunidad se registra en la tabla `arbitrage_opportunities` en formato humano (tasas divididas entre $10^6$ como números decimales `real`).

---

## ⏱️ Duración Empírica de las Brechas de Oportunidad

A partir de las mediciones cuantitativas realizadas en la base de datos D1:

| Métrica | Valor Empírico Medido |
|---------|-----------------------|
| ⏱️ **Tiempo Promedio de Duración de una Tasa:** | **335 segundos (~5.58 minutos)** |
| 📦 **Bloques Promedio entre Ajustes de Tasa:** | **168 bloques** (~2s por bloque en Base Mainnet) |
| ⚡ **Frecuencia en Volatilidad:** | **Cada 120 segundos (~2.0 minutos / 60 bloques)** |

### 💡 Implicaciones para la Ejecución:
- **Ventana de Ejecución:** Una vez detectada la oportunidad, la brecha permanece abierta aproximadamente entre **60 y 150 bloques (2 a 5 minutos)** antes de que el administrador actualice el precio con la función `setPriceConfig`.
- **Estrategia de Ráfagas:** Los operadores masivos aprovechan estos 2 a 5 minutos para enviar entre **3 y 5 órdenes seguidas de $250 USDC** antes de que el precio sea corregido on-chain.

---

## 📲 Configuración de Telegram (.env)

Para recibir las alertas en tu teléfono/Telegram, agrega estas dos variables en tu archivo `.env`:

```env
TELEGRAM_BOT_TOKEN="tu_bot_token_aqui"
TELEGRAM_CHAT_ID="tu_chat_id_aqui"
MIN_PROFIT_MARGIN_PCT=1.0
```

---

## 🚀 Cómo ejecutar la aplicación

```bash
# Desde la raíz del proyecto:
pnpm --filter @p2p-arbitrage-bot dev
```
