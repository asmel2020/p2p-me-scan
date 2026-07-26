# 🤖 P2P Arbitrage Bot — Telegram Alert Monitor

Bot independiente de monitoreo de arbitraje P2P en tiempo real entre el contrato Diamond en **Base Mainnet** y el mercado **Binance P2P (VES/USDC)** con **alertas automáticas a Telegram**.

---

## 📌 ¿Cómo funciona el Bot?

1. **Monitoreo Silencioso (Sin Spamear la Consola):** Los logs continuos de cada bloque están silenciados (`silentConsoleLogs: true`). El bot trabaja en segundo plano sin llenar la consola.
2. **Chequeo Bidireccional (Dos Lados):**
   * **Lado 1:** Comprar en Contrato Diamond P2P $\rightarrow$ Vender en Binance P2P por PagoMovil.
   * **Lado 2:** Comprar en Binance P2P por PagoMovil $\rightarrow$ Vender en Contrato Diamond P2P.
3. **Notificación Instantánea a Telegram:** Cuando el margen neto de ganancia de cualquiera de los dos lados supera el umbral configurado (`> 1.0%`), envía un mensaje formateado a tu chat/canal de Telegram con los datos de la oportunidad y la ganancia proyectada en USD.
4. **Protección Anti-Spam (Cooldown):** Tiene un sistema de tiempo de espera (`alertCooldownMs = 30000`) de 30 segundos entre alertas para no saturar tu Telegram cuando la tasa se mantiene favorable durante varios bloques.

---

## 📲 Configuración de Telegram (.env)

Para recibir las alertas en tu teléfono/Telegram, agrega estas dos variables en tu archivo `.env`:

```env
TELEGRAM_BOT_TOKEN="tu_bot_token_aqui"
TELEGRAM_CHAT_ID="tu_chat_id_aqui"
```

### Pasos rápidos para obtener tu Token y Chat ID:
1. Habla con `@BotFather` en Telegram, envía `/newbot` y copia el **HTTP API Token**.
2. Inicia un chat con tu nuevo bot (envíale `/start`).
3. Obten tu **Chat ID** usando `@userinfobot` o enviando un mensaje a tu bot y consultando `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`.

---

## 🚀 Cómo ejecutar la aplicación

```bash
# Desde la raíz del proyecto:
pnpm --filter @p2p-arbitrage-bot dev
```

---

## 📱 Ejemplo del Mensaje que Recibirás en Telegram

```html
🚨 ¡OPORTUNIDAD DE ARBITRAJE DETECTADA (LADO 1)! 🚨

📦 Bloque: 49120346
🟢 Acción: Comprar en Contrato ➡️ Vender en Binance P2P

🔹 Tasa Compra Contrato: 858.42 VES/USDC
🔹 Tasa Venta Binance P2P: 902.11 VES/USDC
📈 Spread Bruto: +43.69 VES/USDC
⚡ Margen Neto: +5.09%

💵 Ganancia Proyectada ($250 USDC): +$12.72 USDC
```
