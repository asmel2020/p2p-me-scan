# 🔬 Reporte Completo de Investigación de Arbitraje On-Chain

Este documento contiene los hallazgos, evidencia matemática, transacciones y direcciones en la blockchain de la investigación sobre el comportamiento de precios y arbitraje en el contrato P2P Diamond de **Base Mainnet**.

---

## 📌 Resumen de Hallazgos

1. **Monitoreo de Precios Fiat por Bloque:** Se implementó el almacenamiento continuo de `getPriceConfig("VEN")` en D1 (`block_prices`), guardando la tasa formateada (`878.79`, `844.32`, etc.) bloque por bloque en Base Mainnet (~2s por bloque).
2. **Existencia de Arbitraje de Latencia Bidireccional:** El contrato P2P ajusta sus precios con un retraso (latencia) de **2 a 6 minutos** respecto al mercado real de Binance P2P.
3. **Estrategia en Dos Fases:**
   * **Fase 1 (Sondeo / Exploración):** Un bot envía y cancela decenas de micro-órdenes ($0.44 - $1.00 USD) para testear la respuesta y latencia del contrato sin arriesgar capital.
   * **Fase 2 (Ejecución Whale):** Una cuenta Whale entra inmediatamente después en ráfagas de órdenes de **$250 USDC cada 4-5 minutos** aprovechando el desfase de tasa.
4. **Money Trail (Ruta del Dinero On-Chain):**
   * **Lado 1 (Comprar Contrato -> Vender Binance):** Compran USDC barato en el contrato Diamond $\rightarrow$ Envían a Billetera Intermediaria $\rightarrow$ Depositan en **Binance Hot Wallet 2 (`0xEe7aE85f2Fe2239E27D9c1E23fFFe168D63b4055`)** $\rightarrow$ Venden en Binance P2P por PagoMovil.
   * **Lado 2 (Comprar Binance -> Vender Contrato):** Compran USDT/USDC en Binance P2P $\rightarrow$ Retiran USDC desde **Binance Hot Wallet 2** $\rightarrow$ Venden USDC al contrato Diamond a tasa inflada.

---

## 🎯 Direcciones Clave Identificadas

| Rol / Tipo | Dirección en Base Mainnet | Descripción |
|------------|----------------------------|-------------|
| **Contrato Diamond P2P** | `0x4cad6eC90e65baBec9335cAd728DDC610c316368` | Contrato inteligente principal del protocolo |
| **Binance Hot Wallet 2** | `0xEe7aE85f2Fe2239E27D9c1E23fFFe168D63b4055` | Dirección de depósito/retiro de Binance CEX |
| **Bot Explorador (Sondeador)** | `0x0776852ef593cabd26ae43765f22179e89c41178` | Bot que envía y cancela micro-órdenes (45+ cancelaciones) |
| **Whale Lado 1 (Comprador)** | `0x58903b37754acb59b686e97d94409d68375ac2d2` | Ejecutora de ráfagas masivas de $250 USDC |
| **Whale Lado 2 (Vendedor)** | `0x618a03e93f061a777700afc38b94beba063dff13` | Recibe USDC directo de Binance y vende en contrato |
| **Billetera Intermediaria** | `0xC26375024AF88D9288Bea15791f136b9640de8de` | Billetera de salto entre la Whale y Binance |

---

## 📊 Caso de Estudio: Rango de Bloques 49111389 a 49111614 (25 de Julio)

### Eventos Cronológicos y Variación de Tasas

```text
Bloque 49111389 (20:42:05 UTC) | Tasa Contrato: Buy 905.90 / Sell 870.37
├─ Orden #638172 (100 USDC) creada a 870.37 VES.
├─ Orden #638173 (250 USDC) creada a 870.37 VES.

Bloque 49111396 (20:42:19 UTC) | Transacción de Ajuste de Precio
└─ Tasa cae a: Buy 902.11 / Sell 866.74

Bloque 49111478 (20:45:03 UTC) | Transacción de Ajuste Brusco (El Salto)
└─ Tasa cae a: Buy 869.06 / Sell 834.98 (-33.05 VES en 1 minuto)
   └─ Orden #638172 completada en este bloque a la tasa vieja de 870.37 VES cuando el mercado de venta cayó a 834.98 VES.

Bloque 49111514 (20:46:15 UTC) | Transacción de Corrección
└─ Tasa sube a: Buy 872.20 / Sell 837.99

Bloque 49111576 (20:48:19 UTC) | Ajuste Fino
└─ Tasa se fija en: Buy 871.59 / Sell 837.41
   └─ Órdenes #638181 y #638182 (250 USDC c/u) aceptadas e ingresadas.
```

---

## 🛠️ Herramientas de Investigación Creadas

Los scripts de investigación se encuentran en la carpeta `src/local/`:

1. **`fill-prices.ts`**: Rellena precios bloque por bloque en D1 para cualquier rango de bloques histórico.
2. **`inspect-transactions.ts`**: Correlaciona transacciones y eventos de órdenes con el precio exacto del bloque.
3. **`check-user-arbitrage.ts`**: Analiza el historial completo de direcciones de usuario en la base de datos.
4. **`find-top-users.ts`**: Clasifica el Top de usuarios por volumen ($ USDC) y cantidad de transacciones por fecha.
5. **`analyze-bot-and-whale.ts`**: Mide la correlación temporal entre el bot explorador y las entradas del Top 1 Whale.
6. **`check-whale-price-moments.ts`**: Mide la trayectoria del precio a 50 y 200 bloques después de cada orden.
7. **`trace-whale-transfers.ts`**: Rastrea transferencias salientes de USDC desde las billeteras objetivo.
8. **`trace-second-hop.ts`**: Rastrea el segundo salto de transferencias hasta identificar la Hot Wallet de Binance.
9. **`analyze-both-sides-arbitrage.ts`**: Demuestra el arbitraje bidireccional (Lado 1 y Lado 2).
