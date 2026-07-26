ALTER TABLE block_prices ADD COLUMN binance_buy_price REAL NOT NULL DEFAULT 0;
ALTER TABLE block_prices ADD COLUMN binance_sell_price REAL NOT NULL DEFAULT 0;
