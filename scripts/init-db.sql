-- Initialize MEV Searcher Database

-- Create tables for tracking opportunities and bundles
CREATE TABLE IF NOT EXISTS opportunities (
    id SERIAL PRIMARY KEY,
    strategy VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    expected_profit_usd DECIMAL(18, 2) NOT NULL,
    gas_estimate BIGINT NOT NULL,
    target_block INTEGER NOT NULL,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE,
    success BOOLEAN,
    actual_profit_usd DECIMAL(18, 2),
    bundle_hash VARCHAR(66),
    relay VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for bundle submissions
CREATE TABLE IF NOT EXISTS bundle_submissions (
    id SERIAL PRIMARY KEY,
    opportunity_id INTEGER REFERENCES opportunities(id),
    bundle_hash VARCHAR(66) NOT NULL,
    relay VARCHAR(50) NOT NULL,
    target_block INTEGER NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    included BOOLEAN DEFAULT FALSE,
    inclusion_block INTEGER,
    profit_wei BIGINT,
    profit_usd DECIMAL(18, 2),
    gas_used BIGINT,
    gas_price_gwei DECIMAL(18, 9),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for transaction classifications
CREATE TABLE IF NOT EXISTS classified_transactions (
    id SERIAL PRIMARY KEY,
    tx_hash VARCHAR(66) UNIQUE NOT NULL,
    tx_type VARCHAR(50) NOT NULL,
    protocol VARCHAR(50),
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42),
    value_wei BIGINT NOT NULL,
    gas_price_gwei DECIMAL(18, 9) NOT NULL,
    classified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for metrics snapshots
CREATE TABLE IF NOT EXISTS metrics_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active_forks INTEGER,
    queue_size INTEGER,
    healthy_rpcs INTEGER,
    simulation_success_rate DECIMAL(5, 4),
    bundle_inclusion_rate DECIMAL(5, 4),
    total_profit_usd DECIMAL(18, 2),
    failed_gas_burn_wei BIGINT
);

-- Create indexes for performance
CREATE INDEX idx_opportunities_strategy ON opportunities(strategy);
CREATE INDEX idx_opportunities_detected_at ON opportunities(detected_at DESC);
CREATE INDEX idx_bundle_submissions_relay ON bundle_submissions(relay);
CREATE INDEX idx_bundle_submissions_target_block ON bundle_submissions(target_block);
CREATE INDEX idx_classified_transactions_type ON classified_transactions(tx_type);
CREATE INDEX idx_metrics_snapshots_time ON metrics_snapshots(snapshot_time DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for opportunities table
CREATE TRIGGER update_opportunities_updated_at
    BEFORE UPDATE ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for strategy performance
CREATE OR REPLACE VIEW strategy_performance AS
SELECT
    strategy,
    COUNT(*) as total_opportunities,
    SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful,
    SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed,
    AVG(expected_profit_usd) as avg_expected_profit,
    AVG(actual_profit_usd) as avg_actual_profit,
    SUM(actual_profit_usd) as total_profit
FROM opportunities
WHERE processed = true
GROUP BY strategy;

-- Create view for relay performance
CREATE OR REPLACE VIEW relay_performance AS
SELECT
    relay,
    COUNT(*) as total_submissions,
    SUM(CASE WHEN included = true THEN 1 ELSE 0 END) as inclusions,
    ROUND(SUM(CASE WHEN included = true THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric, 4) as inclusion_rate,
    AVG(gas_price_gwei) as avg_gas_price,
    SUM(profit_usd) as total_profit
FROM bundle_submissions
GROUP BY relay;

-- Insert initial metrics snapshot
INSERT INTO metrics_snapshots (active_forks, queue_size, healthy_rpcs, simulation_success_rate, bundle_inclusion_rate, total_profit_usd, failed_gas_burn_wei)
VALUES (0, 0, 0, 0.0, 0.0, 0.0, 0);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mev;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mev;
