# 📁 Investigación y Análisis On-Chain — chain-event-indexer

Esta carpeta dentro de `apps/chain-event-indexer/src/` organiza la documentación, análisis de datos, trazas de blockchain y reportes sobre el comportamiento de precios, rutas de dinero y arbitraje en el contrato Diamond de **Base Mainnet**.

---

## 📄 Documentos de Investigación

- [WEEKLY_ARBITRAGE_REPORT.md](WEEKLY_ARBITRAGE_REPORT.md): **Informe Completo de la Semana (19-26 Julio)**. Incluye las Top 15 Billeteras, horarios pico de operación (UTC vs VET), Money Trail detallado hacia Binance Hot Wallet 2, y análisis de la red de bots exploradores (Lado 1 y Lado 2).
- [RESEARCH_REPORT.md](RESEARCH_REPORT.md): Reporte inicial con direcciones identificadas, money trail y caso de estudio bloque por bloque.

---

## 🛠️ Ubicación de los Scripts de Investigación (`src/investigation/scripts/`)

| Script | Descripción |
|--------|-------------|
| `trace-all-top-wallets.ts` | Rastrea horarios pico de operación y rutas on-chain completas (hacia/desde Binance Hot Wallet 2) de las Top Billeteras. |
| `analyze-full-week.ts` | Filtra y analiza todas las órdenes de la semana o del histórico en D1. |
| `fill-prices.ts` | Rellena precios bloque por bloque en D1 para cualquier rango histórico. |
| `inspect-transactions.ts` | Muestra órdenes y eventos con el precio exacto de cada bloque. |
| `check-user-arbitrage.ts` | Analiza el historial completo de una dirección en la DB. |
| `find-top-users.ts` | Clasifica Top Usuarios por volumen ($ USDC) y cantidad de transacciones por fecha. |
| `analyze-bot-and-whale.ts` | Mide la correlación temporal entre el bot explorador y la Whale. |
| `check-whale-price-moments.ts` | Mide la trayectoria del precio a 50 y 200 bloques después de cada orden. |
| `trace-whale-transfers.ts` | Rastrea transferencias salientes de USDC desde las billeteras objetivo. |
| `trace-second-hop.ts` | Rastrea el segundo salto de transferencias hasta la Binance Hot Wallet. |
| `analyze-both-sides-arbitrage.ts` | Demuestra la evidencia del arbitraje bidireccional (Lado 1 y Lado 2). |
